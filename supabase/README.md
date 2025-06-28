# Georgia Water Quality Database Schema

This directory contains the complete database schema and data import tools for the Georgia public water quality data based on SDWIS Q1 2025 export.

## 🏗️ Database Structure

### Core Tables
- **`public_water_systems`** - Main table for 5,647 Georgia water systems
- **`violations_enforcement`** - 151,085 violation and enforcement records 
- **`geographic_areas`** - Geographic service areas and locations
- **`reference_codes`** - Lookup codes for violation types, system types, etc.
- **`facilities`** - Water system facilities and infrastructure
- **`lcr_samples`** - Lead and Copper Rule monitoring samples
- **`site_visits`** - Regulatory inspection visits
- **`events_milestones`** - System compliance milestones

### Key Views for Dashboards
- **`system_health_dashboard`** - Real-time red/yellow/green health status
- **`current_violations_summary`** - Violation statistics by system
- **`violation_trends`** - Historical violation trends by year
- **`county_summary`** - County-level aggregated data

## 🚀 Getting Started

### 1. Start Supabase locally
```bash
# In the project root
supabase start
```

### 2. Apply the schema migration
```bash
supabase db reset
```
This will create all tables, views, indexes, and seed reference data.

### 3. Import the CSV data
```bash
# Install Python dependencies
pip install psycopg2-binary

# Run the import script
cd scripts
python import_data.py --data-dir ../data
```

### 4. Verify the import
```sql
-- Check data quality
SELECT * FROM data_quality_report;

-- View system health status
SELECT * FROM system_health_dashboard LIMIT 10;

-- Check violation trends
SELECT * FROM violation_trends WHERE violation_year >= 2020;
```

## 📊 Key Queries for Visualizations

### For Public Dashboard - "Is My Water Safe?"
```sql
-- Find water system by location
SELECT h.*, g.county_served, g.city_served 
FROM system_health_dashboard h
JOIN geographic_areas g ON h.pwsid = g.pwsid
WHERE g.zip_code_served = '30309'  -- Atlanta zip code
   OR g.city_served ILIKE '%atlanta%';

-- Health violations in my area
SELECT p.pws_name, v.violation_code, v.violation_status, 
       v.non_compl_per_begin_date, r.value_description
FROM public_water_systems p
JOIN violations_enforcement v ON p.pwsid = v.pwsid
JOIN reference_codes r ON r.value_type = 'VIOLATION_CODE' AND r.value_code = v.violation_code
WHERE v.is_health_based_ind = 'Y' 
  AND v.violation_status = 'Unaddressed'
  AND p.pwsid IN (SELECT pwsid FROM geographic_areas WHERE county_served = 'Fulton');
```

### For Operators Dashboard - "What Needs Fixing?"
```sql
-- My system's current violations
SELECT v.violation_code, v.violation_status, v.non_compl_per_begin_date,
       r.value_description, v.public_notification_tier
FROM violations_enforcement v
JOIN reference_codes r ON r.value_type = 'VIOLATION_CODE' AND r.value_code = v.violation_code
WHERE v.pwsid = 'GA0000001'  -- Replace with actual PWSID
  AND v.violation_status IN ('Unaddressed', 'Addressed')
ORDER BY v.non_compl_per_begin_date DESC;

-- Peer system comparison
SELECT p.pws_name, p.population_served_count,
       COUNT(v.violation_id) as total_violations,
       COUNT(CASE WHEN v.is_health_based_ind = 'Y' THEN 1 END) as health_violations
FROM public_water_systems p
LEFT JOIN violations_enforcement v ON p.pwsid = v.pwsid
WHERE p.pws_type_code = 'CWS'  -- Community systems
  AND p.population_served_count BETWEEN 500 AND 2000  -- Similar size
GROUP BY p.pwsid, p.pws_name, p.population_served_count
ORDER BY total_violations DESC;
```

### For Regulators Dashboard - "Where to Focus?"
```sql
-- Systems needing immediate attention
SELECT p.pws_name, p.population_served_count, g.county_served,
       COUNT(CASE WHEN v.is_health_based_ind = 'Y' AND v.violation_status = 'Unaddressed' THEN 1 END) as critical_violations,
       COUNT(CASE WHEN v.violation_status = 'Unaddressed' THEN 1 END) as total_unaddressed,
       MAX(v.non_compl_per_begin_date) as latest_violation
FROM public_water_systems p
LEFT JOIN violations_enforcement v ON p.pwsid = v.pwsid
LEFT JOIN geographic_areas g ON p.pwsid = g.pwsid AND g.area_type_code = 'CN'
WHERE p.pws_activity_code = 'A'  -- Active systems only
GROUP BY p.pwsid, p.pws_name, p.population_served_count, g.county_served
HAVING COUNT(CASE WHEN v.is_health_based_ind = 'Y' AND v.violation_status = 'Unaddressed' THEN 1 END) > 0
ORDER BY critical_violations DESC, total_unaddressed DESC;

-- County-level violation heatmap
SELECT * FROM county_summary 
WHERE critical_violations > 0
ORDER BY critical_violations DESC;
```

## 🔍 Data Quality Features

### Automated Data Validation
- Date parsing with error handling (`parse_date_mmddyyyy()`)
- Safe type conversion functions (`safe_to_integer()`, `safe_to_decimal()`)
- String cleaning and length validation
- Foreign key constraints ensure data integrity

### Quality Monitoring
```sql
-- Run after import to check data quality
SELECT * FROM data_quality_report;

-- Check for missing critical data
SELECT COUNT(*) as systems_missing_location
FROM public_water_systems p
LEFT JOIN geographic_areas g ON p.pwsid = g.pwsid
WHERE g.pwsid IS NULL;
```

## 🚀 Performance Optimizations

### Indexes for Fast Queries
- **PWSID lookups** - Primary key for all joins
- **Geographic searches** - County, zip code, city indexes
- **Violation filtering** - Status, health-based, date range indexes
- **Aggregation queries** - Population, system type indexes

### Query Optimization
```sql
-- Run after large data imports
ANALYZE public_water_systems;
ANALYZE violations_enforcement;
ANALYZE geographic_areas;
```

## 🔐 Security Features

### Row Level Security (RLS)
- Enabled on sensitive tables
- Public read access policies configured
- Ready for multi-tenant applications

### Audit Trail
- `created_at` and `updated_at` timestamps on all tables
- Automatic triggers for update tracking

## 📱 API Integration

### Supabase Auto-Generated APIs
All tables automatically get REST and GraphQL APIs:
```javascript
// Get water system by PWSID
const { data } = await supabase
  .from('system_health_dashboard')
  .select('*')
  .eq('pwsid', 'GA0000001');

// Get violations in a county
const { data } = await supabase
  .from('violations_enforcement')
  .select(`*, public_water_systems!inner(*)`)
  .eq('public_water_systems.county_served', 'Fulton')
  .eq('is_health_based_ind', 'Y');
```

## 🛠️ Development Tips

### Schema Changes
```bash
# Create new migration
supabase migration new add_new_feature

# Apply migrations
supabase db reset
```

### Data Re-import
```bash
# Import specific tables only
python import_data.py --tables ref systems
python import_data.py --tables violations
python import_data.py --tables geo
```

### Testing Queries
```bash
# Connect to local database
supabase db diff --use-migra
psql postgresql://postgres:postgres@localhost:54322/postgres
```

## 📊 Dashboard Implementation Notes

Based on the analysis of 238,726 records:
- **Focus on the 1,234 unaddressed violations** for immediate public concern
- **Red/Yellow/Green health status** provides intuitive public interface
- **Historical trends** show improvement since 2017 peak
- **Geographic clustering** reveals patterns for regulatory focus
- **Population-weighted metrics** ensure equity across system sizes

The schema is optimized for the three primary user groups:
1. **Public** - Fast system lookup and health status
2. **Operators** - Compliance tracking and peer comparison  
3. **Regulators** - Risk assessment and resource allocation 