#!/usr/bin/env python3
"""
Georgia Water Quality Data Import Script
Imports CSV files from the data directory into Supabase database
"""

import os
import sys
import csv
import psycopg2
from psycopg2.extras import execute_batch
from datetime import datetime
import argparse
from pathlib import Path
from dotenv import load_dotenv

# Add the parent directory to the path so we can import from the project
sys.path.append(str(Path(__file__).parent.parent))

# Load environment variables from .env file
load_dotenv()

# Database configuration from environment variables
DB_CONFIG = {
    'host': os.getenv('DB_HOST', '127.0.0.1'),
    'port': int(os.getenv('DB_PORT', 54322)),
    'database': os.getenv('DB_NAME', 'postgres'),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', 'postgres')
}

class WaterDataImporter:
    def __init__(self, data_dir='../data'):
        self.data_dir = Path(data_dir)
        self.conn = None
        self.cursor = None
        
    def connect(self):
        """Connect to the Supabase database"""
        try:
            self.conn = psycopg2.connect(**DB_CONFIG)
            self.conn.autocommit = False
            self.cursor = self.conn.cursor()
            print("✅ Connected to Supabase database")
        except Exception as e:
            print(f"❌ Failed to connect to database: {e}")
            sys.exit(1)
            
    def disconnect(self):
        """Close database connection"""
        if self.cursor:
            self.cursor.close()
        if self.conn:
            self.conn.close()
            
    def safe_date(self, date_str):
        """Convert MM/DD/YYYY date string to database format"""
        if not date_str or date_str.strip() == '':
            return None
        try:
            # Handle MM/DD/YYYY format
            return datetime.strptime(date_str.strip(), '%m/%d/%Y').date()
        except:
            return None
            
    def safe_int(self, value):
        """Safely convert to integer"""
        if not value or value.strip() == '':
            return None
        try:
            return int(value)
        except:
            return None
            
    def safe_float(self, value):
        """Safely convert to float"""
        if not value or value.strip() == '':
            return None
        try:
            return float(value)
        except:
            return None
            
    def clean_string(self, value, max_length=None):
        """Clean and truncate string values"""
        if not value:
            return None
        cleaned = value.strip()
        if cleaned == '':
            return None
        if max_length and len(cleaned) > max_length:
            cleaned = cleaned[:max_length]
        return cleaned

    def import_reference_codes(self):
        """Import reference codes from SDWA_REF_CODE_VALUES.csv"""
        file_path = self.data_dir / 'SDWA_REF_CODE_VALUES.csv'
        
        if not file_path.exists():
            print(f"⚠️  Reference codes file not found: {file_path}")
            return
            
        print(f"📥 Importing reference codes from {file_path}")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            batch_data = []
            
            for row in reader:
                batch_data.append((
                    self.clean_string(row['VALUE_TYPE'], 40),
                    self.clean_string(row['VALUE_CODE'], 40),
                    self.clean_string(row['VALUE_DESCRIPTION'], 250)
                ))
                
        query = """
        INSERT INTO reference_codes (value_type, value_code, value_description)
        VALUES (%s, %s, %s)
        ON CONFLICT (value_type, value_code) DO UPDATE SET
            value_description = EXCLUDED.value_description,
            updated_at = NOW()
        """
        
        try:
            execute_batch(self.cursor, query, batch_data, page_size=1000)
            self.conn.commit()
            print(f"✅ Imported {len(batch_data)} reference codes")
        except Exception as e:
            self.conn.rollback()
            print(f"❌ Error importing reference codes: {e}")

    def import_public_water_systems(self):
        """Import public water systems from SDWA_PUB_WATER_SYSTEMS.csv"""
        file_path = self.data_dir / 'SDWA_PUB_WATER_SYSTEMS.csv'
        
        if not file_path.exists():
            print(f"⚠️  Water systems file not found: {file_path}")
            return
            
        print(f"📥 Importing public water systems from {file_path}")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            batch_data = []
            
            for row in reader:
                batch_data.append((
                    self.clean_string(row['SUBMISSIONYEARQUARTER'], 7),
                    self.clean_string(row['PWSID'], 9),
                    self.clean_string(row['PWS_NAME'], 100),
                    self.clean_string(row['PRIMACY_AGENCY_CODE'], 2),
                    self.clean_string(row['EPA_REGION'], 2),
                    self.clean_string(row['SEASON_BEGIN_DATE'], 5),
                    self.clean_string(row['SEASON_END_DATE'], 5),
                    self.clean_string(row['PWS_ACTIVITY_CODE'], 1),
                    self.safe_date(row['PWS_DEACTIVATION_DATE']),
                    self.clean_string(row['PWS_TYPE_CODE'], 6),
                    self.clean_string(row['DBPR_SCHEDULE_CAT_CODE'], 6),
                    self.clean_string(row['CDS_ID'], 100),
                    self.clean_string(row['GW_SW_CODE'], 2),
                    self.clean_string(row['LT2_SCHEDULE_CAT_CODE'], 6),
                    self.clean_string(row['OWNER_TYPE_CODE'], 1),
                    self.safe_int(row['POPULATION_SERVED_COUNT']),
                    self.clean_string(row['POP_CAT_2_CODE'], 2),
                    self.clean_string(row['POP_CAT_3_CODE'], 2),
                    self.clean_string(row['POP_CAT_4_CODE'], 2),
                    self.clean_string(row['POP_CAT_5_CODE'], 2),
                    self.clean_string(row['POP_CAT_11_CODE'], 2),
                    self.clean_string(row['PRIMACY_TYPE'], 20),
                    self.clean_string(row['PRIMARY_SOURCE_CODE'], 4),
                    self.clean_string(row['IS_GRANT_ELIGIBLE_IND'], 1),
                    self.clean_string(row['IS_WHOLESALER_IND'], 1),
                    self.clean_string(row['IS_SCHOOL_OR_DAYCARE_IND'], 1),
                    self.safe_int(row['SERVICE_CONNECTIONS_COUNT']),
                    self.clean_string(row['SUBMISSION_STATUS_CODE'], 1),
                    self.clean_string(row['ORG_NAME'], 100),
                    self.clean_string(row['ADMIN_NAME'], 100),
                    self.clean_string(row['EMAIL_ADDR'], 100),
                    self.clean_string(row['PHONE_NUMBER'], 15),
                    self.clean_string(row['PHONE_EXT_NUMBER'], 5),
                    self.clean_string(row['FAX_NUMBER'], 15),
                    self.clean_string(row['ALT_PHONE_NUMBER'], 15),
                    self.clean_string(row['ADDRESS_LINE1'], 200),
                    self.clean_string(row['ADDRESS_LINE2'], 200),
                    self.clean_string(row['CITY_NAME'], 40),
                    self.clean_string(row['ZIP_CODE'], 14),
                    self.clean_string(row['COUNTRY_CODE'], 2),
                    self.safe_date(row['FIRST_REPORTED_DATE']),
                    self.safe_date(row['LAST_REPORTED_DATE']),
                    self.clean_string(row['STATE_CODE'], 2),
                    self.clean_string(row['SOURCE_WATER_PROTECTION_CODE'], 2),
                    self.safe_date(row['SOURCE_PROTECTION_BEGIN_DATE']),
                    self.clean_string(row['OUTSTANDING_PERFORMER'], 2),
                    self.safe_date(row['OUTSTANDING_PERFORM_BEGIN_DATE']),
                    self.clean_string(row['REDUCED_RTCR_MONITORING'], 20),
                    self.safe_date(row['REDUCED_MONITORING_BEGIN_DATE']),
                    self.safe_date(row['REDUCED_MONITORING_END_DATE']),
                    self.clean_string(row['SEASONAL_STARTUP_SYSTEM'], 40)
                ))
                
        query = """
        INSERT INTO public_water_systems (
            submission_year_quarter, pwsid, pws_name, primacy_agency_code, epa_region,
            season_begin_date, season_end_date, pws_activity_code, pws_deactivation_date,
            pws_type_code, dbpr_schedule_cat_code, cds_id, gw_sw_code, lt2_schedule_cat_code,
            owner_type_code, population_served_count, pop_cat_2_code, pop_cat_3_code,
            pop_cat_4_code, pop_cat_5_code, pop_cat_11_code, primacy_type, primary_source_code,
            is_grant_eligible_ind, is_wholesaler_ind, is_school_or_daycare_ind,
            service_connections_count, submission_status_code, org_name, admin_name,
            email_addr, phone_number, phone_ext_number, fax_number, alt_phone_number,
            address_line1, address_line2, city_name, zip_code, country_code,
            first_reported_date, last_reported_date, state_code, source_water_protection_code,
            source_protection_begin_date, outstanding_performer, outstanding_perform_begin_date,
            reduced_rtcr_monitoring, reduced_monitoring_begin_date, reduced_monitoring_end_date,
            seasonal_startup_system
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (submission_year_quarter, pwsid) DO UPDATE SET
            pws_name = EXCLUDED.pws_name,
            population_served_count = EXCLUDED.population_served_count,
            updated_at = NOW()
        """
        
        try:
            execute_batch(self.cursor, query, batch_data, page_size=500)
            self.conn.commit()
            print(f"✅ Imported {len(batch_data)} public water systems")
        except Exception as e:
            self.conn.rollback()
            print(f"❌ Error importing public water systems: {e}")

    def import_violations_enforcement(self):
        """Import violations from SDWA_VIOLATIONS_ENFORCEMENT.csv"""
        file_path = self.data_dir / 'SDWA_VIOLATIONS_ENFORCEMENT.csv'
        
        if not file_path.exists():
            print(f"⚠️  Violations file not found: {file_path}")
            return
            
        print(f"📥 Importing violations and enforcement from {file_path}")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            batch_data = []
            count = 0
            skipped = 0
            
            for row in reader:
                count += 1
                
                # Skip rows with empty/null violation_id since it's required
                violation_id = self.clean_string(row['VIOLATION_ID'], 20)
                if violation_id is None or violation_id == '':
                    skipped += 1
                    continue
                    
                batch_data.append((
                    self.clean_string(row['SUBMISSIONYEARQUARTER'], 7),
                    self.clean_string(row['PWSID'], 9),
                    violation_id,
                    self.clean_string(row['FACILITY_ID'], 12),
                    self.safe_date(row['COMPL_PER_BEGIN_DATE']),
                    self.safe_date(row['COMPL_PER_END_DATE']),
                    self.safe_date(row['NON_COMPL_PER_BEGIN_DATE']),
                    self.safe_date(row['NON_COMPL_PER_END_DATE']),
                    self.safe_date(row['PWS_DEACTIVATION_DATE']),
                    self.clean_string(row['VIOLATION_CODE'], 4),
                    self.clean_string(row['VIOLATION_CATEGORY_CODE'], 5),
                    self.clean_string(row['IS_HEALTH_BASED_IND'], 1),
                    self.clean_string(row['CONTAMINANT_CODE'], 4),
                    self.safe_float(row['VIOL_MEASURE']),
                    self.clean_string(row['UNIT_OF_MEASURE'], 9),
                    self.clean_string(row['FEDERAL_MCL'], 31),
                    self.safe_float(row['STATE_MCL']),
                    self.clean_string(row['IS_MAJOR_VIOL_IND'], 1),
                    self.safe_int(row['SEVERITY_IND_CNT']),
                    self.safe_date(row['CALCULATED_RTC_DATE']),
                    self.clean_string(row['VIOLATION_STATUS'], 11),
                    self.safe_int(row['PUBLIC_NOTIFICATION_TIER']),
                    self.safe_int(row['CALCULATED_PUB_NOTIF_TIER']),
                    self.clean_string(row['VIOL_ORIGINATOR_CODE'], 4),
                    self.clean_string(row['SAMPLE_RESULT_ID'], 40),
                    self.clean_string(row['CORRECTIVE_ACTION_ID'], 40),
                    self.clean_string(row['RULE_CODE'], 3),
                    self.clean_string(row['RULE_GROUP_CODE'], 3),
                    self.clean_string(row['RULE_FAMILY_CODE'], 3),
                    self.safe_date(row['VIOL_FIRST_REPORTED_DATE']),
                    self.safe_date(row['VIOL_LAST_REPORTED_DATE']),
                    self.clean_string(row['ENFORCEMENT_ID'], 20),
                    self.safe_date(row['ENFORCEMENT_DATE']),
                    self.clean_string(row['ENFORCEMENT_ACTION_TYPE_CODE'], 4),
                    self.clean_string(row['ENF_ACTION_CATEGORY'], 4000),
                    self.clean_string(row['ENF_ORIGINATOR_CODE'], 4),
                    self.safe_date(row['ENF_FIRST_REPORTED_DATE']),
                    self.safe_date(row['ENF_LAST_REPORTED_DATE'])
                ))
                
                # Process in batches to avoid memory issues
                if len(batch_data) >= 1000:
                    self.process_violations_batch(batch_data)
                    batch_data = []
                    print(f"  Processed {count} violations...")
                    
            # Process remaining batch
            if batch_data:
                self.process_violations_batch(batch_data)
                
            print(f"✅ Imported {count - skipped} violations and enforcement records")
            if skipped > 0:
                print(f"⚠️  Skipped {skipped} rows with missing violation_id")

    def process_violations_batch(self, batch_data):
        """Process a batch of violations data"""
        query = """
        INSERT INTO violations_enforcement (
            submission_year_quarter, pwsid, violation_id, facility_id,
            compl_per_begin_date, compl_per_end_date, non_compl_per_begin_date,
            non_compl_per_end_date, pws_deactivation_date, violation_code,
            violation_category_code, is_health_based_ind, contaminant_code,
            viol_measure, unit_of_measure, federal_mcl, state_mcl,
            is_major_viol_ind, severity_ind_cnt, calculated_rtc_date,
            violation_status, public_notification_tier, calculated_pub_notif_tier,
            viol_originator_code, sample_result_id, corrective_action_id,
            rule_code, rule_group_code, rule_family_code,
            viol_first_reported_date, viol_last_reported_date,
            enforcement_id, enforcement_date, enforcement_action_type_code,
            enf_action_category, enf_originator_code,
            enf_first_reported_date, enf_last_reported_date
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (submission_year_quarter, pwsid, violation_id) DO UPDATE SET
            violation_status = EXCLUDED.violation_status,
            updated_at = NOW()
        """
        
        try:
            execute_batch(self.cursor, query, batch_data, page_size=500)
            self.conn.commit()
        except Exception as e:
            self.conn.rollback()
            print(f"❌ Error processing violations batch: {e}")
            raise

    def import_geographic_areas(self):
        """Import geographic areas from SDWA_GEOGRAPHIC_AREAS.csv"""
        file_path = self.data_dir / 'SDWA_GEOGRAPHIC_AREAS.csv'
        
        if not file_path.exists():
            print(f"⚠️  Geographic areas file not found: {file_path}")
            return
            
        print(f"📥 Importing geographic areas from {file_path}")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            batch_data = []
            
            for row in reader:
                batch_data.append((
                    self.clean_string(row['SUBMISSIONYEARQUARTER'], 7),
                    self.clean_string(row['PWSID'], 9),
                    self.clean_string(row['GEO_ID'], 20),
                    self.clean_string(row['AREA_TYPE_CODE'], 4),
                    self.clean_string(row['TRIBAL_CODE'], 10),
                    self.clean_string(row['STATE_SERVED'], 4),
                    self.clean_string(row['ANSI_ENTITY_CODE'], 4),
                    self.clean_string(row['ZIP_CODE_SERVED'], 5),
                    self.clean_string(row['CITY_SERVED'], 40),
                    self.clean_string(row['COUNTY_SERVED'], 40),
                    self.safe_date(row['LAST_REPORTED_DATE'])
                ))
                
        query = """
        INSERT INTO geographic_areas (
            submission_year_quarter, pwsid, geo_id, area_type_code,
            tribal_code, state_served, ansi_entity_code, zip_code_served,
            city_served, county_served, last_reported_date
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (submission_year_quarter, pwsid, geo_id) DO UPDATE SET
            county_served = EXCLUDED.county_served,
            city_served = EXCLUDED.city_served
        """
        
        try:
            execute_batch(self.cursor, query, batch_data, page_size=1000)
            self.conn.commit()
            print(f"✅ Imported {len(batch_data)} geographic areas")
        except Exception as e:
            self.conn.rollback()
            print(f"❌ Error importing geographic areas: {e}")

    def import_all_data(self):
        """Import all CSV files in the correct order"""
        print("🚀 Starting Georgia Water Quality data import...")
        
        # Import in order of dependencies
        self.import_reference_codes()
        self.import_public_water_systems()
        self.import_geographic_areas()
        self.import_violations_enforcement()
        
        # Run analysis for query optimization
        print("📊 Running database analysis for optimization...")
        try:
            self.cursor.execute("ANALYZE public_water_systems;")
            self.cursor.execute("ANALYZE violations_enforcement;")
            self.cursor.execute("ANALYZE geographic_areas;")
            self.cursor.execute("ANALYZE reference_codes;")
            self.conn.commit()
            print("✅ Database analysis complete")
        except Exception as e:
            print(f"⚠️  Warning: Could not run analysis: {e}")
        
        print("\n🎉 Data import complete!")
        print("\nNext steps:")
        print("1. Check data quality: SELECT * FROM data_quality_report;")
        print("2. View system health: SELECT * FROM system_health_dashboard LIMIT 10;")
        print("3. Check violation trends: SELECT * FROM violation_trends;")

def main():
    parser = argparse.ArgumentParser(description='Import Georgia water quality CSV data into Supabase')
    parser.add_argument('--data-dir', default='../data', help='Directory containing CSV files')
    parser.add_argument('--tables', nargs='+', choices=['ref', 'systems', 'violations', 'geo', 'all'], 
                       default=['all'], help='Which tables to import')
    
    args = parser.parse_args()
    
    importer = WaterDataImporter(args.data_dir)
    
    try:
        importer.connect()
        
        if 'all' in args.tables:
            importer.import_all_data()
        else:
            if 'ref' in args.tables:
                importer.import_reference_codes()
            if 'systems' in args.tables:
                importer.import_public_water_systems()
            if 'geo' in args.tables:
                importer.import_geographic_areas()
            if 'violations' in args.tables:
                importer.import_violations_enforcement()
                
    except KeyboardInterrupt:
        print("\n⏹️  Import interrupted by user")
    except Exception as e:
        print(f"❌ Import failed: {e}")
    finally:
        importer.disconnect()

if __name__ == '__main__':
    main() 