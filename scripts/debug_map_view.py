#!/usr/bin/env python3
"""
Debug script to investigate why the violations_map_data view is empty
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
    """Main debug function"""
    
    try:
        # Create Supabase client
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info("✅ Connected to Supabase")
        
        # Check individual components of the view
        logger.info("\n🔍 Debugging violations_map_data view...")
        
        # 1. Check violation_locations with coordinates
        logger.info("1. Checking violation_locations with valid coordinates...")
        vl_with_coords = supabase.table('violation_locations').select('*').is_('water_system_location_id', 'not.null').limit(5).execute()
        logger.info(f"   • violation_locations with location_id: {len(vl_with_coords.data)} (showing first 5)")
        if vl_with_coords.data:
            sample = vl_with_coords.data[0]
            logger.info(f"   • Sample: {sample.get('pwsid')} - location_id: {sample.get('water_system_location_id')}")
        
        # 2. Check water_system_locations with coordinates
        logger.info("2. Checking water_system_locations with coordinates...")
        wsl_with_coords = supabase.table('water_system_locations').select('*').is_('latitude', 'not.null').is_('longitude', 'not.null').limit(5).execute()
        logger.info(f"   • water_system_locations with coordinates: {len(wsl_with_coords.data)} (showing first 5)")
        if wsl_with_coords.data:
            sample = wsl_with_coords.data[0]
            logger.info(f"   • Sample: {sample.get('pwsid')} at {sample.get('latitude')}, {sample.get('longitude')}")
        
        # 3. Check join between tables
        logger.info("3. Checking if violations have matching water system locations...")
        
        # Alternative: check if any violation_locations have valid water_system_location_id
        vl_sample = supabase.table('violation_locations').select('violation_id,pwsid,water_system_location_id').is_('water_system_location_id', 'not.null').limit(1).execute()
        if vl_sample.data:
            location_id = vl_sample.data[0]['water_system_location_id']
            logger.info(f"   • Sample violation location_id: {location_id}")
            
            # Check if this location exists in water_system_locations
            wsl_check = supabase.table('water_system_locations').select('*').eq('id', location_id).execute()
            logger.info(f"   • Corresponding water_system_location exists: {len(wsl_check.data) > 0}")
            if wsl_check.data:
                wsl = wsl_check.data[0]
                logger.info(f"   • Location details: lat={wsl.get('latitude')}, lng={wsl.get('longitude')}")
        
        # 4. Check the view definition issue
        logger.info("4. Trying to fetch from violations_map_data view directly...")
        try:
            map_data = supabase.table('violations_map_data').select('*').limit(5).execute()
            logger.info(f"   • violations_map_data records: {len(map_data.data)}")
            if map_data.data:
                logger.info(f"   • Sample map data: {map_data.data[0]}")
        except Exception as e:
            logger.error(f"   • Error querying view: {e}")
        
        # 5. Try a simpler query to test the joins
        logger.info("5. Testing simpler approach - check if we can join manually...")
        try:
            # Get a violation location with location_id
            vl_with_location = supabase.table('violation_locations').select('violation_id,pwsid,water_system_location_id').is_('water_system_location_id', 'not.null').limit(1).execute()
            
            if vl_with_location.data:
                location_id = vl_with_location.data[0]['water_system_location_id']
                
                # Get the corresponding water system location  
                wsl = supabase.table('water_system_locations').select('*').eq('id', location_id).execute()
                
                if wsl.data:
                    logger.info(f"   • Manual join works! Location has coordinates: {wsl.data[0].get('latitude')}, {wsl.data[0].get('longitude')}")
                else:
                    logger.warning(f"   • No water_system_location found for ID: {location_id}")
            else:
                logger.warning("   • No violation_locations with water_system_location_id found")
                
        except Exception as e:
            logger.error(f"   • Error with manual join: {e}")
            
        # 6. Check for submission_year_quarter consistency
        logger.info("6. Checking submission_year_quarter consistency...")
        
        # Get distinct quarters from each table
        vl_sample_quarters = supabase.table('violation_locations').select('submission_year_quarter').limit(10).execute()
        wsl_sample_quarters = supabase.table('water_system_locations').select('submission_year_quarter').limit(10).execute()
        pws_sample_quarters = supabase.table('public_water_systems').select('submission_year_quarter').limit(10).execute()
        
        vl_quarters = list(set([item.get('submission_year_quarter') for item in vl_sample_quarters.data if item.get('submission_year_quarter')]))
        wsl_quarters = list(set([item.get('submission_year_quarter') for item in wsl_sample_quarters.data if item.get('submission_year_quarter')]))
        pws_quarters = list(set([item.get('submission_year_quarter') for item in pws_sample_quarters.data if item.get('submission_year_quarter')]))
        
        logger.info(f"   • violation_locations quarters: {vl_quarters}")
        logger.info(f"   • water_system_locations quarters: {wsl_quarters}")
        logger.info(f"   • public_water_systems quarters: {pws_quarters}")
        
        # 7. Check if the issue is with the view's hardcoded '2025Q1'
        logger.info("7. Checking if view is filtering by '2025Q1'...")
        pws_2025q1 = supabase.table('public_water_systems').select('pwsid').eq('submission_year_quarter', '2025Q1').limit(5).execute()
        logger.info(f"   • public_water_systems with 2025Q1: {len(pws_2025q1.data)}")
        
        if len(pws_2025q1.data) == 0:
            logger.warning("   ⚠️  No PWS records with '2025Q1' - this is likely the issue!")
            logger.info("   💡 The view is hardcoded to filter by '2025Q1' but your data uses different quarters")
            
            # Suggest the most common quarter
            if pws_quarters:
                most_common_quarter = pws_quarters[0]  # Just take the first one as example
                logger.info(f"   💡 Try updating the view to use '{most_common_quarter}' instead")
        
        logger.info("\n💡 Analysis complete! Check the output above for issues.")
            
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main() 