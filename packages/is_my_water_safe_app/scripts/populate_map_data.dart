/// Script to populate map location data
///
/// This script populates the water_system_locations and violation_locations
/// tables from the existing public_water_systems and violations_enforcement data.

import 'package:supabase_flutter/supabase_flutter.dart';

Future<void> main() async {
  // Initialize Supabase with local development config
  await Supabase.initialize(
    url: 'http://localhost:54321',
    anonKey:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
  );

  final client = Supabase.instance.client;

  try {
    print('🚰 Populating water system locations...');

    // Call the database function to populate water system locations
    final systemLocationsResult = await client.rpc('populate_water_system_locations');
    print('✅ Populated $systemLocationsResult water system locations');

    print('🗺️ Populating violation locations...');

    // Call the database function to populate violation locations
    final violationLocationsResult = await client.rpc('populate_violation_locations');
    print('✅ Populated $violationLocationsResult violation locations');

    print('🎯 Checking data...');

    // Check how many violations have location data
    final violationsWithLocations = await client.from('violations_map_data').select('violation_id').count();

    print('📍 Total violations with location data: ${violationsWithLocations.count}');

    // Sample some data to verify
    final sampleData = await client
        .from('violations_map_data')
        .select('violation_id, pws_name, latitude, longitude, severity_level')
        .not('latitude', 'is', null)
        .limit(5);

    print('📋 Sample violations with coordinates:');
    for (final row in sampleData) {
      print(
        '  - ${row['pws_name']} (${row['violation_id']}): ${row['latitude']}, ${row['longitude']} [${row['severity_level']}]',
      );
    }

    print('\n🎉 Map data population complete!');
    print('💡 You can now use the map view with real violation data.');
  } catch (e) {
    print('❌ Error populating map data: $e');
    print('\n💡 Make sure:');
    print('   1. Supabase is running locally (supabase start)');
    print('   2. Database schema is applied (supabase db reset)');
    print('   3. CSV data has been imported (python scripts/import_data.py)');
  }
}
