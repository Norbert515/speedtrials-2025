SELECT 
  'public_water_systems' as table_name,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE pws_activity_code = 'A') as active_systems
FROM public_water_systems
UNION ALL
SELECT 
  'system_health_dashboard',
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE health_status IS NOT NULL) as systems_with_status
FROM system_health_dashboard
UNION ALL
SELECT 
  'violations_enforcement',
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE is_health_based_ind = 'Y') as health_violations
FROM violations_enforcement;
