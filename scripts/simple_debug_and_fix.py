#!/usr/bin/env python3
"""
Simple debug and fix script for the map view issue
"""

import logging
from supabase import create_client, Client

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Supabase connection
SUPABASE_URL = "http://127.0.0.1:54321"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

def main():
    """Simple debug and fix"""
    
    try:
        # Create Supabase client
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info("✅ Connected to Supabase")
        
        logger.info("\n🔍 Quick diagnosis...")
        
        # 1. Check basic counts
        logger.info("1. Basic table counts:")
        vl_count = supabase.table('violation_locations').select('id', count='exact').execute()
        wsl_count = supabase.table('water_system_locations').select('id', count='exact').execute()
        
        logger.info(f"   • violation_locations: {vl_count.count}")
        logger.info(f"   • water_system_locations: {wsl_count.count}")
        
        # 2. Check sample data
        logger.info("2. Sample data:")
        vl_sample = supabase.table('violation_locations').select('*').limit(1).execute()
        wsl_sample = supabase.table('water_system_locations').select('*').limit(1).execute()
        
        if vl_sample.data:
            vl = vl_sample.data[0]
            logger.info(f"   • Sample violation_location: {vl.get('pwsid')} -> location_id: {vl.get('water_system_location_id')}")
        
        if wsl_sample.data:
            wsl = wsl_sample.data[0]
            logger.info(f"   • Sample water_system_location: {wsl.get('pwsid')} -> lat: {wsl.get('latitude')}, lng: {wsl.get('longitude')}")
        
        # 3. Check quarters
        logger.info("3. Data quarters:")
        pws_sample = supabase.table('public_water_systems').select('submission_year_quarter').limit(5).execute()
        wsl_quarter_sample = supabase.table('water_system_locations').select('submission_year_quarter').limit(1).execute()
        
        pws_quarters = list(set([item.get('submission_year_quarter') for item in pws_sample.data]))
        wsl_quarters = list(set([item.get('submission_year_quarter') for item in wsl_quarter_sample.data]))
        
        logger.info(f"   • PWS quarters: {pws_quarters}")
        logger.info(f"   • WSL quarters: {wsl_quarters}")
        
        # 4. Check if 2025Q1 exists
        pws_2025q1 = supabase.table('public_water_systems').select('pwsid').eq('submission_year_quarter', '2025Q1').limit(1).execute()
        logger.info(f"   • PWS with 2025Q1: {len(pws_2025q1.data)}")
        
        # 5. Try to check the view 
        logger.info("4. Checking violations_map_data view:")
        try:
            map_view_count = supabase.table('violations_map_data').select('violation_id', count='exact').execute()
            logger.info(f"   • violations_map_data count: {map_view_count.count}")
        except Exception as e:
            logger.error(f"   • Error querying view: {e}")
        
        # PROPOSED FIX: Update the view to use the correct quarter
        if len(pws_2025q1.data) == 0 and pws_quarters:
            actual_quarter = pws_quarters[0]
            logger.info(f"\n🔧 ISSUE FOUND: View expects '2025Q1' but data uses '{actual_quarter}'")
            logger.info("   Attempting to fix the view...")
            
            # Create updated view SQL
            updated_view_sql = f"""
            CREATE OR REPLACE VIEW violations_map_data AS
            SELECT 
                vl.violation_id,
                vl.pwsid,
                p.pws_name,
                COALESCE(vl.latitude, wsl.latitude) as latitude,
                COALESCE(vl.longitude, wsl.longitude) as longitude,
                wsl.full_address,
                wsl.county_name,
                p.population_served_count,
                p.pws_type_code,
                v.violation_status,
                v.is_health_based_ind,
                v.violation_category_code,
                v.contaminant_code,
                v.non_compl_per_begin_date,
                v.non_compl_per_end_date,
                g.county_served,
                g.city_served,
                g.zip_code_served,
                rc_cont.value_description as contaminant_name,
                rc_viol.value_description as violation_description,
                vl.severity_level,
                vl.map_color,
                vl.violation_count,
                wsl.geocoding_accuracy,
                wsl.geocoded_at
            FROM violation_locations vl
            JOIN water_system_locations wsl ON vl.water_system_location_id = wsl.id
            JOIN public_water_systems p ON vl.pwsid = p.pwsid AND p.submission_year_quarter = '{actual_quarter}'
            JOIN violations_enforcement v ON vl.violation_id = v.violation_id AND vl.pwsid = v.pwsid
            LEFT JOIN geographic_areas g ON vl.pwsid = g.pwsid AND g.area_type_code = 'CN'
            LEFT JOIN reference_codes rc_cont ON rc_cont.value_type = 'CONTAMINANT_CODE' 
                AND rc_cont.value_code = v.contaminant_code
            LEFT JOIN reference_codes rc_viol ON rc_viol.value_type = 'VIOLATION_CODE' 
                AND rc_viol.value_code = v.violation_code
            WHERE (vl.latitude IS NOT NULL OR wsl.latitude IS NOT NULL)
                AND (vl.longitude IS NOT NULL OR wsl.longitude IS NOT NULL)
                AND p.pws_activity_code = 'A';
            """
            
            try:
                # Execute the view update
                result = supabase.rpc('exec_sql', {'sql': updated_view_sql}).execute()
                logger.info("   ✅ Successfully updated violations_map_data view!")
                
                # Test the updated view
                updated_count = supabase.table('violations_map_data').select('violation_id', count='exact').execute()
                logger.info(f"   ✅ Updated view now has {updated_count.count} records!")
                
                if updated_count.count > 0:
                    # Get a sample
                    sample = supabase.table('violations_map_data').select('*').limit(1).execute()
                    if sample.data:
                        sample_data = sample.data[0]
                        logger.info(f"   📍 Sample: {sample_data.get('pws_name')} at {sample_data.get('latitude')}, {sample_data.get('longitude')}")
                        logger.info("   🎉 Your Flutter app should now show data on the map!")
                
            except Exception as e:
                logger.error(f"   ❌ Failed to update view: {e}")
                logger.info("   💡 You may need to manually update the view in the database")
        else:
            logger.info("\n✅ Data quarters look correct, investigating other issues...")
            
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main() 