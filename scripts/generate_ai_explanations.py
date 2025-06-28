#!/usr/bin/env python3
"""
AI Explanation Generator for Water Quality Violations

This script generates plain-English explanations for health-based water quality violations
to help public understanding. It uses OpenAI's API to create explanations and stores them
in the violation_ai_explanations table.

Usage:
    python generate_ai_explanations.py [--dry-run] [--limit N] [--regenerate] [--include-historical]
"""

import os
import sys
import argparse
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import psycopg2
from psycopg2.extras import RealDictCursor
import openai
from dataclasses import dataclass

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

@dataclass
class ViolationContext:
    """Data structure for violation context used in AI generation"""
    submission_year_quarter: str
    violation_id: str
    pwsid: str
    pws_name: str
    population_served: int
    is_school_or_daycare: bool
    contaminant_code: str
    contaminant_name: str
    violation_code: str
    violation_description: str
    viol_measure: Optional[float]
    unit_of_measure: Optional[str]
    federal_mcl: Optional[str]
    state_mcl: Optional[float]
    violation_status: str
    non_compl_per_begin_date: str
    non_compl_per_end_date: Optional[str]
    public_notification_tier: Optional[int]
    county_served: Optional[str]
    city_served: Optional[str]
    
class AIExplanationGenerator:
    def __init__(self, db_url: str, openai_api_key: str, dry_run: bool = False):
        self.db_url = db_url
        self.dry_run = dry_run
        self.openai_client = openai.OpenAI(api_key=openai_api_key)
        self.model_version = "gpt-4o-mini-v1"
        
        # Setup logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(__name__)
        
    def connect_db(self) -> psycopg2.extensions.connection:
        """Create database connection"""
        return psycopg2.connect(self.db_url, cursor_factory=RealDictCursor)
    
    def get_violations_needing_explanations(self, limit: Optional[int] = None, regenerate: bool = False, include_historical: bool = False) -> List[ViolationContext]:
        """Query database for health violations that need AI explanations"""
        with self.connect_db() as conn:
            with conn.cursor() as cur:
                # Determine which violation statuses to include
                if include_historical:
                    # Include all violations (current and historical)
                    status_filter = "v.violation_status IN ('Unaddressed', 'Addressed', 'Resolved', 'Archived')"
                else:
                    # Only current violations (default behavior)
                    status_filter = "v.violation_status IN ('Unaddressed', 'Addressed')"
                
                if regenerate:
                    # Get all health violations for regeneration
                    where_clause = f"""
                    WHERE v.is_health_based_ind = 'Y'
                      AND {status_filter}
                    """
                else:
                    # Only get violations without current explanations
                    where_clause = f"""
                    WHERE v.is_health_based_ind = 'Y'
                      AND {status_filter}
                      AND NOT EXISTS (
                          SELECT 1 FROM violation_ai_explanations ai 
                          WHERE ai.submission_year_quarter = v.submission_year_quarter 
                            AND ai.violation_id = v.violation_id AND ai.is_current = TRUE
                      )
                    """
                
                query = f"""
                SELECT 
                    v.submission_year_quarter,
                    v.violation_id,
                    v.pwsid,
                    p.pws_name,
                    COALESCE(p.population_served_count, 0) as population_served,
                    COALESCE(p.is_school_or_daycare_ind = 'Y', FALSE) as is_school_or_daycare,
                    v.contaminant_code,
                    COALESCE(rc_cont.value_description, 'Unknown Contaminant') as contaminant_name,
                    v.violation_code,
                    COALESCE(rc_viol.value_description, 'Unknown Violation') as violation_description,
                    v.viol_measure,
                    v.unit_of_measure,
                    v.federal_mcl,
                    v.state_mcl,
                    v.violation_status,
                    v.non_compl_per_begin_date::text,
                    v.non_compl_per_end_date::text,
                    v.public_notification_tier,
                    geo.county_served,
                    geo.city_served
                FROM violations_enforcement v
                JOIN public_water_systems p ON v.pwsid = p.pwsid
                LEFT JOIN reference_codes rc_cont ON rc_cont.value_type = 'CONTAMINANT_CODE' AND rc_cont.value_code = v.contaminant_code
                LEFT JOIN reference_codes rc_viol ON rc_viol.value_type = 'VIOLATION_CODE' AND rc_viol.value_code = v.violation_code
                LEFT JOIN geographic_areas geo ON v.pwsid = geo.pwsid AND geo.area_type_code = 'CN'
                {where_clause}
                ORDER BY 
                    -- Current violations first, then historical by date
                    CASE WHEN v.violation_status IN ('Unaddressed', 'Addressed') THEN 1 
                         ELSE 2 END,
                    -- Within each category, most recent violations first
                    COALESCE(v.non_compl_per_begin_date, '1900-01-01'::date) DESC,
                    -- Break ties with population impact (larger systems first)
                    p.population_served_count DESC,
                    -- Final tie-breaker with status priority
                    CASE WHEN v.violation_status = 'Unaddressed' THEN 1 
                         WHEN v.violation_status = 'Addressed' THEN 2
                         WHEN v.violation_status = 'Resolved' THEN 3
                         WHEN v.violation_status = 'Archived' THEN 4
                         ELSE 5 END
                """
                
                if limit:
                    query += f" LIMIT {limit}"
                
                self.logger.info(f"Querying violations with: {where_clause.strip()}")
                cur.execute(query)
                results = cur.fetchall()
                
                violations = []
                for row in results:
                    violations.append(ViolationContext(**row))
                
                self.logger.info(f"Found {len(violations)} violations needing explanations")
                return violations
    
    def calculate_severity_score(self, violation: ViolationContext) -> int:
        """Calculate a severity score from 1-10 based on multiple factors"""
        score = 5  # Base score
        
        # Contaminant type severity
        high_risk_contaminants = ['1005', '2050', '2047', '2046']  # Arsenic, Atrazine, Aldicarb, Carbofuran
        medium_risk_contaminants = ['1095', '1919', '1930']  # Zinc, Calcium, TDS
        
        if violation.contaminant_code in high_risk_contaminants:
            score += 3
        elif violation.contaminant_code in medium_risk_contaminants:
            score += 1
        
        # Violation status
        if violation.violation_status == 'Unaddressed':
            score += 2
        elif violation.violation_status == 'Addressed':
            score += 1
        elif violation.violation_status == 'Resolved':
            score -= 1  # Historical, reduce severity
        elif violation.violation_status == 'Archived':
            score -= 2  # Very old, reduce severity significantly
        
        # Population impact
        if violation.population_served > 10000:
            score += 2
        elif violation.population_served > 1000:
            score += 1
        
        # Vulnerable populations
        if violation.is_school_or_daycare:
            score += 2
            
        # Public notification tier
        if violation.public_notification_tier == 1:
            score += 3
        elif violation.public_notification_tier == 2:
            score += 1
        
        # MCL exceedance level
        if violation.viol_measure and violation.federal_mcl:
            try:
                mcl_value = float(violation.federal_mcl)
                if mcl_value > 0 and violation.viol_measure > mcl_value * 2:
                    score += 2
                elif mcl_value > 0 and violation.viol_measure > mcl_value * 1.5:
                    score += 1
            except (ValueError, TypeError):
                pass
        
        return min(max(score, 1), 10)  # Clamp between 1-10
    
    def determine_health_risk_level(self, severity_score: int, violation: ViolationContext) -> str:
        """Determine health risk level based on severity score and context"""
        if severity_score >= 8:
            return 'CRITICAL'
        elif severity_score >= 6:
            return 'HIGH'
        elif severity_score >= 4:
            return 'MEDIUM'
        else:
            return 'LOW'
    
    def get_contaminant_health_info(self, contaminant_code: str, contaminant_name: str) -> Dict[str, str]:
        """Get detailed health information for specific contaminants"""
        health_info = {
            '1005': {  # Arsenic
                'health_effects': 'skin problems, circulatory issues, and increased cancer risk (bladder, lung, skin)',
                'vulnerable_groups': 'pregnant women, children, and individuals with compromised immune systems',
                'acute_vs_chronic': 'chronic exposure over years'
            },
            '2050': {  # Atrazine
                'health_effects': 'cardiovascular problems and reproductive issues',
                'vulnerable_groups': 'pregnant women and developing children',
                'acute_vs_chronic': 'long-term exposure'
            },
            'default': {
                'health_effects': 'various health problems depending on the contaminant level and duration of exposure',
                'vulnerable_groups': 'infants, young children, pregnant women, elderly, and immunocompromised individuals',
                'acute_vs_chronic': 'prolonged exposure'
            }
        }
        
        return health_info.get(contaminant_code, health_info['default'])
    
    def generate_ai_explanation(self, violation: ViolationContext) -> Dict[str, str]:
        """Generate AI explanation using OpenAI API"""
        severity_score = self.calculate_severity_score(violation)
        health_risk_level = self.determine_health_risk_level(severity_score, violation)
        health_info = self.get_contaminant_health_info(violation.contaminant_code, violation.contaminant_name)
        
        # Calculate days since violation began
        try:
            begin_date = datetime.strptime(violation.non_compl_per_begin_date, '%Y-%m-%d')
            days_since = (datetime.now() - begin_date).days
        except:
            days_since = 0
        
        # Determine if this is a historical violation
        is_historical = violation.violation_status in ['Resolved', 'Archived']
        
        # Build context for AI
        context = f"""
        Water System: {violation.pws_name} (PWSID: {violation.pwsid})
        Location: {violation.city_served}, {violation.county_served} County, Georgia
        Population Served: {violation.population_served:,}
        School/Daycare System: {'Yes' if violation.is_school_or_daycare else 'No'}
        
        Violation Details:
        - Contaminant: {violation.contaminant_name} (Code: {violation.contaminant_code})
        - Violation Type: {violation.violation_description}
        - Measured Level: {violation.viol_measure} {violation.unit_of_measure if violation.unit_of_measure else ''}
        - Federal Limit (MCL): {violation.federal_mcl if violation.federal_mcl else 'Not specified'}
        - Status: {violation.violation_status} {'(PAST VIOLATION - Has been resolved)' if is_historical else '(CURRENT VIOLATION)'}
        - Duration: {days_since} days since violation began
        - Public Notification Tier: {violation.public_notification_tier if violation.public_notification_tier else 'Not specified'}
        
        Health Information:
        - Typical Health Effects: {health_info['health_effects']}
        - Most Vulnerable Groups: {health_info['vulnerable_groups']}
        - Exposure Type: {health_info['acute_vs_chronic']}
        """
        
        prompt = f"""
        You are a public health communication expert helping residents understand water quality violations.
        Create a clear, accessible explanation of this drinking water violation for public consumption.
        
        {context}
        
        Please provide a response in JSON format with these exact fields:
        
        {{
            "explanation_text": "A 2-3 sentence clear explanation of what happened and why it matters",
            "health_impact": "Specific health effects this contaminant can cause, focusing on the most relevant risks",
            "recommended_actions": "Practical steps residents can take (e.g., filters, bottled water, boiling)",
            "timeline_context": "How long this has been an issue and what to expect for resolution",
            "vulnerable_groups": "Who is most at risk (infants, pregnant women, elderly, etc.)",
            "contaminant_explanation": "What this contaminant is and how it gets into water in simple terms"
        }}
        
        Guidelines:
        - Use plain English, avoid technical jargon
        - Be factual but not alarmist
        - Focus on actionable information
        - Keep each field concise but informative
        - Mention specific risk levels when appropriate
        {'- IMPORTANT: This is a PAST violation that has been resolved. Make sure to clarify this in your explanation and recommended actions.' if is_historical else '- IMPORTANT: This is a CURRENT active violation requiring immediate attention.'}
        """
        
        try:
            response = self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a helpful public health communication expert."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=1000
            )
            
            content = response.choices[0].message.content.strip()
            
            # Try to parse as JSON
            try:
                ai_response = json.loads(content)
            except json.JSONDecodeError:
                # If not valid JSON, try to extract from code blocks
                if '```json' in content:
                    json_start = content.find('```json') + 7
                    json_end = content.find('```', json_start)
                    json_content = content[json_start:json_end].strip()
                    ai_response = json.loads(json_content)
                else:
                    raise ValueError("Could not parse AI response as JSON")
            
            # Add metadata
            ai_response['severity_score'] = severity_score
            ai_response['health_risk_level'] = health_risk_level
            
            return ai_response
            
        except Exception as e:
            self.logger.error(f"Error generating AI explanation for violation {violation.violation_id}: {e}")
            
            # Fallback explanation
            status_text = "was previously detected and has been resolved" if is_historical else "exceeded federal safety standards"
            action_text = ("This violation has been resolved, but you can review your water system's history for transparency." if is_historical 
                          else "Consider using bottled water or a certified water filter until this violation is resolved. Contact your water system for updates.")
            timeline_text = (f"This violation occurred {days_since} days ago and has since been resolved." if is_historical
                            else f"This violation has been ongoing for {days_since} days. Resolution timeline depends on the specific remediation required.")
            
            return {
                'explanation_text': f"The {violation.contaminant_name} level in your water system {status_text}. {'This provides transparency about your water system history.' if is_historical else 'This violation requires attention to ensure safe drinking water.'}",
                'health_impact': health_info['health_effects'],
                'recommended_actions': action_text,
                'timeline_context': timeline_text,
                'vulnerable_groups': health_info['vulnerable_groups'],
                'contaminant_explanation': f"{violation.contaminant_name} is a contaminant that can affect drinking water quality and public health.",
                'severity_score': severity_score,
                'health_risk_level': health_risk_level
            }
    
    def save_explanation(self, violation: ViolationContext, explanation: Dict[str, str]) -> bool:
        """Save AI explanation to database"""
        if self.dry_run:
            self.logger.info(f"DRY RUN: Would save explanation for violation {violation.violation_id}")
            return True
        
        try:
            with self.connect_db() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO violation_ai_explanations (
                            submission_year_quarter, violation_id, pwsid, explanation_text, health_risk_level,
                            health_impact, recommended_actions, timeline_context,
                            severity_score, vulnerable_groups, contaminant_explanation,
                            model_version
                        ) VALUES (
                            %(submission_year_quarter)s, %(violation_id)s, %(pwsid)s, %(explanation_text)s, %(health_risk_level)s,
                            %(health_impact)s, %(recommended_actions)s, %(timeline_context)s,
                            %(severity_score)s, %(vulnerable_groups)s, %(contaminant_explanation)s,
                            %(model_version)s
                        )
                    """, {
                        'submission_year_quarter': violation.submission_year_quarter,
                        'violation_id': violation.violation_id,
                        'pwsid': violation.pwsid,
                        'explanation_text': explanation['explanation_text'],
                        'health_risk_level': explanation['health_risk_level'],
                        'health_impact': explanation['health_impact'],
                        'recommended_actions': explanation['recommended_actions'],
                        'timeline_context': explanation['timeline_context'],
                        'severity_score': explanation['severity_score'],
                        'vulnerable_groups': explanation['vulnerable_groups'],
                        'contaminant_explanation': explanation['contaminant_explanation'],
                        'model_version': self.model_version
                    })
                    conn.commit()
                    return True
        except Exception as e:
            self.logger.error(f"Error saving explanation for violation {violation.violation_id}: {e}")
            return False
    
    def generate_explanations(self, limit: Optional[int] = None, regenerate: bool = False, include_historical: bool = False):
        """Main method to generate AI explanations for violations"""
        violations = self.get_violations_needing_explanations(limit, regenerate, include_historical)
        
        if not violations:
            self.logger.info("No violations found that need explanations")
            return
        
        # Show date range summary
        dates = [v.non_compl_per_begin_date for v in violations if v.non_compl_per_begin_date]
        if dates:
            # For YYYY-MM-DD strings, min/max work correctly
            earliest = min(dates)  # Oldest date
            latest = max(dates)    # Most recent date
            self.logger.info(f"Found {len(violations)} violations to process (date range: {latest} to {earliest})")
        else:
            self.logger.info(f"Found {len(violations)} violations to process")
        
        if self.dry_run:
            self.logger.info("DRY RUN MODE - No changes will be made")
        
        success_count = 0
        error_count = 0
        
        for i, violation in enumerate(violations, 1):
            # Show date context for chronological progression  
            date_str = violation.non_compl_per_begin_date if violation.non_compl_per_begin_date else "Unknown date"
            self.logger.info(f"Processing {i}/{len(violations)}: {violation.pws_name} - {violation.contaminant_name} ({date_str}, {violation.violation_status})")
            
            try:
                explanation = self.generate_ai_explanation(violation)
                if self.save_explanation(violation, explanation):
                    success_count += 1
                    self.logger.info(f"✓ Generated explanation for {violation.violation_id}")
                else:
                    error_count += 1
                    
            except Exception as e:
                error_count += 1
                self.logger.error(f"✗ Failed to process violation {violation.violation_id}: {e}")
        
        self.logger.info(f"Completed: {success_count} successful, {error_count} errors")

def main():
    parser = argparse.ArgumentParser(description="Generate AI explanations for water quality violations")
    parser.add_argument('--dry-run', action='store_true', help='Show what would be done without making changes')
    parser.add_argument('--limit', type=int, help='Limit number of violations to process')
    parser.add_argument('--regenerate', action='store_true', help='Regenerate explanations for all violations')
    parser.add_argument('--include-historical', action='store_true', 
                       help='Include historical violations (Resolved/Archived) in addition to current ones')
    
    args = parser.parse_args()
    
    # Get configuration from environment
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        # Default to local supabase
        db_url = "postgresql://postgres:postgres@localhost:54322/postgres"
    
    openai_api_key = os.getenv('OPENAI_API_KEY')
    if not openai_api_key:
        print("Error: OPENAI_API_KEY environment variable is required")
        sys.exit(1)
    
    generator = AIExplanationGenerator(db_url, openai_api_key, args.dry_run)
    generator.generate_explanations(args.limit, args.regenerate, args.include_historical)

if __name__ == "__main__":
    main() 