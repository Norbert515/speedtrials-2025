# Map Setup with Real Violation Data

The Flutter app has been updated to use **real water quality violation data** instead of mock data.

## ✅ Changes Made

1. **Replaced Mock Map with Real Map**
   - Updated `home_screen.dart` to use `MapView()` instead of `MockMapView()`
   - The app now uses the real Supabase data through the `MapRepository`

2. **Map Infrastructure Ready**
   - ✅ Supabase client configured (`lib/config/app_config.dart`)
   - ✅ Map repository implemented (`lib/repository/map_repository.dart`) 
   - ✅ Data models defined (`lib/models/src/map_data.dart`)
   - ✅ Providers configured (`lib/modules/map/map_providers.dart`)
   - ✅ Real map view implemented (`lib/modules/map/map_view.dart`)

## 🚀 How to Use Real Data

### 1. Start Supabase
```bash
# In project root
supabase start
```

### 2. Apply Database Schema
```bash
supabase db reset
```

### 3. Import CSV Data
```bash
# Install Python dependencies
pip install psycopg2-binary

# Import Georgia water quality data
cd scripts
python import_data.py --data-dir ../data
```

### 4. Populate Map Location Data
The database schema includes geocoding tables that need to be populated:

**Option A: Use Supabase Dashboard**
```sql
-- Run these queries in Supabase Studio
SELECT populate_water_system_locations();
SELECT populate_violation_locations();
```

**Option B: Use psql**
```bash
psql postgresql://postgres:postgres@localhost:54322/postgres -c "SELECT populate_water_system_locations();"
psql postgresql://postgres:postgres@localhost:54322/postgres -c "SELECT populate_violation_locations();"
```

### 5. Verify Data
```sql
-- Check violations with location data
SELECT COUNT(*) FROM violations_map_data WHERE latitude IS NOT NULL;

-- Sample violations
SELECT pws_name, latitude, longitude, severity_level 
FROM violations_map_data 
WHERE latitude IS NOT NULL 
LIMIT 5;
```

### 6. Run the App
```bash
fvm flutter run
```

## 📍 Map Features

The map now displays:

- **Real violation markers** from the `violations_map_data` database view
- **Color-coded severity levels**:
  - 🔴 Critical (health-based + unaddressed)
  - 🟠 Warning (health-based)
  - 🔵 Moderate (unaddressed)
  - 🟢 Low (resolved)
- **Interactive markers** with violation details
- **Filter capabilities** (health-based, unaddressed, etc.)
- **Statistics overlay** showing real violation counts

## 🗺️ Database Views Used

The map queries these views:

- **`violations_map_data`** - Main view with violation locations and details
- **`county_violations_map`** - County-level aggregation for choropleth maps
- **`water_system_locations`** - Geocoded water system coordinates
- **`violation_locations`** - Violation-specific location data with severity

## 🎯 Data Flow

1. CSV data → `public_water_systems` & `violations_enforcement` tables
2. Functions populate → `water_system_locations` & `violation_locations` tables  
3. Views join → `violations_map_data` (ready for map display)
4. Flutter app queries → Real-time violation markers on map

## 🔧 Troubleshooting

### No Markers Showing
```sql
-- Check if location data exists
SELECT COUNT(*) FROM water_system_locations WHERE latitude IS NOT NULL;
SELECT COUNT(*) FROM violation_locations;
SELECT COUNT(*) FROM violations_map_data;
```

### Empty Violations Map View
```sql
-- Ensure functions were called
SELECT populate_water_system_locations();
SELECT populate_violation_locations();
```

### Map Not Loading
- Check Supabase connection in `lib/config/app_config.dart`
- Verify local Supabase is running on `http://localhost:54321`
- Check Flutter console for network errors

## 📊 Expected Data

With the Georgia SDWIS Q1 2025 data:
- **~5,647** water systems
- **~151,085** total violations  
- **~1,234** unaddressed violations (showing as map markers)
- Location data for systems with complete addresses

## 🎉 Success!

Once set up, your map will show real Georgia water quality violations instead of mock data, providing users with accurate information about water safety in their area. 