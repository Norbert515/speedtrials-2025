#!/usr/bin/env python3
"""
Script to check and populate map data for the Flutter app.

This script will:
1. Check if there's data in the main tables
2. Check if map views have data
3. Populate the map data if needed
"""

import os
from supabase import create_client, Client
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Supabase connection
SUPABASE_URL = "http://127.0.0.1:54321"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

def main():
    """Main execution function"""
    
    try:
        # Create Supabase client
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info("✅ Connected to Supabase")
        
        # Check main tables
        logger.info("\n📊 Checking main data tables...")
        
        # Check public_water_systems
        pws_count = supabase.table('public_water_systems').select('id', count='exact').execute()
        logger.info(f"   • public_water_systems: {pws_count.count} records")
        
        # Check violations_enforcement  
        violations_count = supabase.table('violations_enforcement').select('id', count='exact').execute()
        logger.info(f"   • violations_enforcement: {violations_count.count} records")
        
        # Check map tables
        logger.info("\n🗺️ Checking map data tables...")
        
        # Check water_system_locations
        try:
            wsl_count = supabase.table('water_system_locations').select('id', count='exact').execute()
            logger.info(f"   • water_system_locations: {wsl_count.count} records")
        except Exception as e:
            logger.info(f"   • water_system_locations: Table not found - {e}")
            wsl_count = None
        
        # Check violation_locations
        try:
            vl_count = supabase.table('violation_locations').select('id', count='exact').execute()
            logger.info(f"   • violation_locations: {vl_count.count} records")
        except Exception as e:
            logger.info(f"   • violation_locations: Table not found - {e}")
            vl_count = None
            
        # Check violations_map_data view
        try:
            map_data_count = supabase.table('violations_map_data').select('violation_id', count='exact').execute()
            logger.info(f"   • violations_map_data (view): {map_data_count.count} records")
        except Exception as e:
            logger.info(f"   • violations_map_data (view): Not available - {e}")
            map_data_count = None
        
        # Determine what needs to be done
        logger.info("\n🔧 Analysis:")
        
        if pws_count.count == 0:
            logger.warning("   ⚠️  No public water systems data found")
            logger.info("   💡 You need to import the CSV data first")
            logger.info("   💡 Run: python scripts/import_data.py")
            return
            
        if violations_count.count == 0:
            logger.warning("   ⚠️  No violations data found")
            logger.info("   💡 You need to import the CSV data first")
            logger.info("   💡 Run: python scripts/import_data.py")
            return
        
        # If main data exists but map data is missing, populate it
        if (wsl_count is None or wsl_count.count == 0) and pws_count.count > 0:
            logger.info("   🚀 Populating water system locations...")
            try:
                result = supabase.rpc('populate_water_system_locations').execute()
                logger.info(f"   ✅ Populated {result.data} water system locations")
            except Exception as e:
                logger.error(f"   ❌ Error populating water system locations: {e}")
        
        if (vl_count is None or vl_count.count == 0) and violations_count.count > 0:
            logger.info("   🚀 Populating violation locations...")
            try:
                result = supabase.rpc('populate_violation_locations').execute()
                logger.info(f"   ✅ Populated {result.data} violation locations")
            except Exception as e:
                logger.error(f"   ❌ Error populating violation locations: {e}")
        
        # Final check
        logger.info("\n🎯 Final status check...")
        try:
            final_map_count = supabase.table('violations_map_data').select('violation_id', count='exact').execute()
            logger.info(f"   • violations_map_data: {final_map_count.count} records available for map")
            
            if final_map_count.count > 0:
                logger.info("   ✅ Map data is ready!")
                logger.info("   🗺️  Your Flutter app should now show violations on the map")
                
                # Show a sample of the data
                sample = supabase.table('violations_map_data').select('pwsid,pws_name,latitude,longitude,severity_level').limit(5).execute()
                logger.info(f"   📍 Sample locations:")
                for record in sample.data:
                    logger.info(f"      • {record.get('pws_name', 'Unknown')} ({record['pwsid']}) at {record['latitude']}, {record['longitude']} - {record['severity_level']}")
            else:
                logger.warning("   ⚠️  Map data still empty - check for errors above")
                
        except Exception as e:
            logger.error(f"   ❌ Error checking final map data: {e}")
            
    except Exception as e:
        logger.error(f"❌ Error connecting to database: {e}")
        logger.info("💡 Make sure Supabase is running: supabase start")

if __name__ == "__main__":
    main() 