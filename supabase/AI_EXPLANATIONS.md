# AI Violation Explanations System

This system generates plain-English explanations of water quality violations to help the public understand what violations mean for their health and safety.

## 🎯 **What It Does**

Transforms technical violation data like this:
```
Contaminant Code: 1005
Violation Measure: 15 UG/L
Federal MCL: 10 UG/L
Violation Status: Unaddressed
```

Into public-friendly explanations like this:
```
"Arsenic in your drinking water was detected at 15 parts per billion, 
which is 1.5x higher than the federal safety limit. Long-term exposure 
to arsenic increases your risk of skin problems and certain cancers. 
Consider using bottled water or a certified arsenic filter until this 
violation is resolved."
```

## 🏗️ **Database Schema**

### New Table: `violation_ai_explanations`

| Field | Type | Description |
|-------|------|-------------|
| `violation_id` | VARCHAR(20) | Links to violations_enforcement table |
| `explanation_text` | TEXT | Main AI-generated explanation |
| `health_risk_level` | VARCHAR(10) | LOW, MEDIUM, HIGH, CRITICAL |
| `health_impact` | TEXT | Specific health effects |
| `recommended_actions` | TEXT | What residents should do |
| `timeline_context` | TEXT | Duration and resolution info |
| `severity_score` | INTEGER | 1-10 calculated severity |
| `vulnerable_groups` | TEXT | Who is most at risk |
| `contaminant_explanation` | TEXT | What the contaminant is |
| `is_current` | BOOLEAN | Supports explanation versioning |

### New View: `public_violation_explanations`

Combines violation data with AI explanations for public consumption. Includes:
- System information (name, population, location)
- Violation details (contaminant, levels, status)
- AI-generated explanations
- Geographic context

## 🚀 **Setup and Usage**

### 1. Apply Database Migration

```bash
# Apply the schema changes
supabase db reset
```

### 2. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 3. Set Environment Variables

```bash
export OPENAI_API_KEY="your-openai-api-key"
export DATABASE_URL="postgresql://postgres:postgres@localhost:54322/postgres"
```

### 4. Generate AI Explanations

```bash
# Generate explanations for current health violations only (default)
cd scripts
python generate_ai_explanations.py

# Include historical violations (Resolved/Archived) for transparency
python generate_ai_explanations.py --include-historical

# Test with dry run (see what would happen)
python generate_ai_explanations.py --dry-run --include-historical

# Process only 10 violations for testing
python generate_ai_explanations.py --limit 10

# Regenerate explanations for all violations (current + historical)
python generate_ai_explanations.py --regenerate --include-historical
```

#### **Violation Status Types:**
- **Unaddressed** (4): Active violations requiring immediate attention
- **Addressed** (2): Violations being worked on
- **Resolved** (1,663): Fixed violations (historical)
- **Archived** (3,602): Old violations >5 years (historical)

By default, only current violations (Unaddressed/Addressed) get explanations. Use `--include-historical` to generate explanations for resolved and archived violations to provide transparency about water system history.

## 📊 **Example Queries**

### Get Violations with AI Explanations

```sql
-- All violations with explanations for public dashboard
SELECT * FROM public_violation_explanations 
WHERE county_served = 'Fulton'
ORDER BY severity_score DESC;
```

### Find Critical Violations in Your Area

```sql
-- High-severity violations in Atlanta area
SELECT 
    pws_name,
    explanation_text,
    health_risk_level,
    recommended_actions
FROM public_violation_explanations
WHERE city_served ILIKE '%atlanta%'
  AND health_risk_level IN ('HIGH', 'CRITICAL')
  AND violation_status = 'Unaddressed';
```

### System Health Overview

```sql
-- Count violations by risk level
SELECT 
    health_risk_level,
    COUNT(*) as violation_count,
    SUM(population_served_count) as people_affected
FROM public_violation_explanations
GROUP BY health_risk_level
ORDER BY 
    CASE health_risk_level 
        WHEN 'CRITICAL' THEN 1 
        WHEN 'HIGH' THEN 2 
        WHEN 'MEDIUM' THEN 3 
        WHEN 'LOW' THEN 4 
    END;
```

## 🎨 **AI Explanation Structure**

Each explanation includes these components:

### **explanation_text** (Main Summary)
- 2-3 sentence overview
- What happened and why it matters
- Plain English, no jargon

### **health_impact** (Health Effects)
- Specific risks from this contaminant
- Short-term vs long-term effects
- Contextualized to violation level

### **recommended_actions** (What To Do)
- Practical steps residents can take
- Filter recommendations
- When to use bottled water
- Who to contact

### **timeline_context** (When & How Long)
- How long violation has existed
- Expected resolution timeline
- Progress on fixes

### **vulnerable_groups** (Who's At Risk)
- Pregnant women, children, elderly
- Specific risk factors
- Extra precautions needed

### **contaminant_explanation** (What It Is)
- What the contaminant is
- How it gets into water
- Why limits exist

## 📜 **Historical Violations**

When using `--include-historical`, the AI generates different explanations for past violations:

### **Historical Context**
- **Resolved violations**: Mentions violation was fixed, provides historical transparency
- **Archived violations**: Notes violation occurred >5 years ago, resolved
- **Adjusted severity**: Historical violations get lower severity scores (-1 for Resolved, -2 for Archived)

### **Different Messaging**
- **explanation_text**: Uses past tense ("was detected and resolved")
- **recommended_actions**: Focuses on transparency rather than immediate action
- **timeline_context**: Mentions when violation occurred and was resolved

### **Example Historical Explanation**
```
"Arsenic was previously detected in your water system at 15 parts per billion, 
which exceeded the federal safety limit. This violation has since been resolved. 
This information provides transparency about your water system's history."
```

## 🧠 **AI Severity Scoring**

The system calculates a 1-10 severity score based on:

| Factor | Score Impact |
|--------|--------------|
| **Contaminant Type** | High-risk (Arsenic, Lead): +3, Medium-risk: +1 |
| **Violation Status** | Unaddressed: +2 |
| **Population Impact** | >10k people: +2, >1k people: +1 |
| **Vulnerable Populations** | Schools/Daycares: +2 |
| **Public Notification Tier** | Tier 1 (Emergency): +3, Tier 2: +1 |
| **MCL Exceedance** | 2x over limit: +2, 1.5x over: +1 |

**Risk Level Mapping:**
- 8-10: **CRITICAL** 🔴
- 6-7: **HIGH** 🟠  
- 4-5: **MEDIUM** 🟡
- 1-3: **LOW** 🟢

## 🔄 **Regeneration and Updates**

The system supports explanation versioning:

- New explanations mark old ones as `is_current = FALSE`
- History is preserved for audit trails
- Can regenerate when AI models improve
- Tracks which model version generated each explanation

## 🚀 **Integration with Frontend**

The `public_violation_explanations` view is ready for:

### Public "Is My Water Safe?" Dashboard
```javascript
// Get violations in user's area with explanations
const { data } = await supabase
  .from('public_violation_explanations')
  .select('*')
  .eq('zip_code_served', userZipCode)
  .order('severity_score', { ascending: false });
```

### System-Specific Pages
```javascript
// Get all violations for a specific water system
const { data } = await supabase
  .from('public_violation_explanations')
  .select('*')
  .eq('pwsid', systemId)
  .eq('violation_status', 'Unaddressed');
```

### Health Risk Filtering
```javascript
// Show only high-risk violations
const { data } = await supabase
  .from('public_violation_explanations')
  .select('*')
  .in('health_risk_level', ['HIGH', 'CRITICAL'])
  .eq('violation_status', 'Unaddressed');
```

## 📈 **Future Enhancements**

1. **Multi-language Support** - Generate explanations in Spanish, etc.
2. **Contaminant-Specific Templates** - Custom prompts for lead, arsenic, etc.
3. **Real-time Updates** - Trigger explanations when new violations are added
4. **A/B Testing** - Compare explanation effectiveness
5. **Integration with SMS/Email** - Send personalized alerts
6. **Visual Explanations** - Generate charts and infographics

## 🔐 **Security & Privacy**

- No personal data is processed by AI
- Only aggregated public health data
- API keys are environment variables only
- Explanations are public information
- No PII in prompts or responses 