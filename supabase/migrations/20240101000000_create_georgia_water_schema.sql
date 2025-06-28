-- Georgia Water Quality Data Schema Migration
-- Based on SDWIS Q1 2025 data export

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================================
-- REFERENCE TABLES
-- ============================================================================

-- Reference codes lookup table
CREATE TABLE IF NOT EXISTS reference_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    value_type VARCHAR(40) NOT NULL,
    value_code VARCHAR(40) NOT NULL,
    value_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(value_type, value_code)
);

-- ANSI areas reference table
CREATE TABLE IF NOT EXISTS ansi_areas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ansi_state_code VARCHAR(2) NOT NULL,
    ansi_entity_code VARCHAR(3) NOT NULL,
    ansi_name VARCHAR(40),
    state_code VARCHAR(2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(ansi_state_code, ansi_entity_code)
);

-- ============================================================================
-- CORE ENTITIES
-- ============================================================================

-- Public Water Systems - Main entity table
CREATE TABLE IF NOT EXISTS public_water_systems (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_year_quarter VARCHAR(7) NOT NULL,
    pwsid VARCHAR(9) NOT NULL,
    pws_name VARCHAR(100),
    primacy_agency_code VARCHAR(2),
    epa_region VARCHAR(2),
    season_begin_date VARCHAR(5),
    season_end_date VARCHAR(5),
    pws_activity_code VARCHAR(1),
    pws_deactivation_date DATE,
    pws_type_code VARCHAR(6),
    dbpr_schedule_cat_code VARCHAR(6),
    cds_id VARCHAR(100),
    gw_sw_code VARCHAR(2),
    lt2_schedule_cat_code VARCHAR(6),
    owner_type_code VARCHAR(1),
    population_served_count INTEGER,
    pop_cat_2_code VARCHAR(2),
    pop_cat_3_code VARCHAR(2),
    pop_cat_4_code VARCHAR(2),
    pop_cat_5_code VARCHAR(2),
    pop_cat_11_code VARCHAR(2),
    primacy_type VARCHAR(20),
    primary_source_code VARCHAR(4),
    is_grant_eligible_ind VARCHAR(1),
    is_wholesaler_ind VARCHAR(1),
    is_school_or_daycare_ind VARCHAR(1),
    service_connections_count INTEGER,
    submission_status_code VARCHAR(1),
    org_name VARCHAR(100),
    admin_name VARCHAR(100),
    email_addr VARCHAR(100),
    phone_number VARCHAR(15),
    phone_ext_number VARCHAR(5),
    fax_number VARCHAR(15),
    alt_phone_number VARCHAR(15),
    address_line1 VARCHAR(200),
    address_line2 VARCHAR(200),
    city_name VARCHAR(40),
    zip_code VARCHAR(14),
    country_code VARCHAR(2),
    first_reported_date DATE,
    last_reported_date DATE,
    state_code VARCHAR(2),
    source_water_protection_code VARCHAR(2),
    source_protection_begin_date DATE,
    outstanding_performer VARCHAR(2),
    outstanding_perform_begin_date DATE,
    reduced_rtcr_monitoring VARCHAR(20),
    reduced_monitoring_begin_date DATE,
    reduced_monitoring_end_date DATE,
    seasonal_startup_system VARCHAR(40),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(submission_year_quarter, pwsid)
);

-- Facilities table
CREATE TABLE IF NOT EXISTS facilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_year_quarter VARCHAR(7) NOT NULL,
    pwsid VARCHAR(9) NOT NULL,
    facility_id VARCHAR(12) NOT NULL,
    facility_name VARCHAR(100),
    state_facility_id VARCHAR(40),
    facility_activity_code VARCHAR(1),
    facility_deactivation_date DATE,
    facility_type_code VARCHAR(4),
    submission_status_code VARCHAR(4),
    is_source_ind VARCHAR(1),
    water_type_code VARCHAR(4),
    availability_code VARCHAR(4),
    seller_treatment_code VARCHAR(4),
    seller_pwsid VARCHAR(9),
    seller_pws_name VARCHAR(100),
    filtration_status_code VARCHAR(4),
    is_source_treated_ind VARCHAR(1),
    first_reported_date DATE,
    last_reported_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(submission_year_quarter, pwsid, facility_id),
    FOREIGN KEY (submission_year_quarter, pwsid) 
        REFERENCES public_water_systems(submission_year_quarter, pwsid)
);

-- ============================================================================
-- VIOLATIONS AND ENFORCEMENT
-- ============================================================================

-- Main violations and enforcement table
CREATE TABLE IF NOT EXISTS violations_enforcement (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_year_quarter VARCHAR(7) NOT NULL,
    pwsid VARCHAR(9) NOT NULL,
    violation_id VARCHAR(20) NOT NULL,
    facility_id VARCHAR(12),
    compl_per_begin_date DATE,
    compl_per_end_date DATE,
    non_compl_per_begin_date DATE,
    non_compl_per_end_date DATE,
    pws_deactivation_date DATE,
    violation_code VARCHAR(4),
    violation_category_code VARCHAR(5),
    is_health_based_ind VARCHAR(1),
    contaminant_code VARCHAR(4),
    viol_measure DECIMAL,
    unit_of_measure VARCHAR(9),
    federal_mcl VARCHAR(31),
    state_mcl DECIMAL,
    is_major_viol_ind VARCHAR(1),
    severity_ind_cnt INTEGER,
    calculated_rtc_date DATE,
    violation_status VARCHAR(11),
    public_notification_tier INTEGER,
    calculated_pub_notif_tier INTEGER,
    viol_originator_code VARCHAR(4),
    sample_result_id VARCHAR(40),
    corrective_action_id VARCHAR(40),
    rule_code VARCHAR(3),
    rule_group_code VARCHAR(3),
    rule_family_code VARCHAR(3),
    viol_first_reported_date DATE,
    viol_last_reported_date DATE,
    enforcement_id VARCHAR(20),
    enforcement_date DATE,
    enforcement_action_type_code VARCHAR(4),
    enf_action_category VARCHAR(4000),
    enf_originator_code VARCHAR(4),
    enf_first_reported_date DATE,
    enf_last_reported_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(submission_year_quarter, pwsid, violation_id),
    FOREIGN KEY (submission_year_quarter, pwsid) 
        REFERENCES public_water_systems(submission_year_quarter, pwsid)
);

-- ============================================================================
-- GEOGRAPHIC AND SERVICE DATA
-- ============================================================================

-- Geographic areas served
CREATE TABLE IF NOT EXISTS geographic_areas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_year_quarter VARCHAR(7) NOT NULL,
    pwsid VARCHAR(9) NOT NULL,
    geo_id VARCHAR(20) NOT NULL,
    area_type_code VARCHAR(4),
    tribal_code VARCHAR(10),
    state_served VARCHAR(4),
    ansi_entity_code VARCHAR(4),
    zip_code_served VARCHAR(5),
    city_served VARCHAR(40),
    county_served VARCHAR(40),
    last_reported_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(submission_year_quarter, pwsid, geo_id),
    FOREIGN KEY (submission_year_quarter, pwsid) 
        REFERENCES public_water_systems(submission_year_quarter, pwsid)
);

-- Service areas
CREATE TABLE IF NOT EXISTS service_areas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_year_quarter VARCHAR(7) NOT NULL,
    pwsid VARCHAR(9) NOT NULL,
    service_area_type_code VARCHAR(4),
    is_primary_service_area_code VARCHAR(1),
    first_reported_date DATE,
    last_reported_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    FOREIGN KEY (submission_year_quarter, pwsid) 
        REFERENCES public_water_systems(submission_year_quarter, pwsid)
);

-- ============================================================================
-- MONITORING AND COMPLIANCE DATA
-- ============================================================================

-- Lead and Copper Rule samples
CREATE TABLE IF NOT EXISTS lcr_samples (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_year_quarter VARCHAR(7) NOT NULL,
    pwsid VARCHAR(9) NOT NULL,
    sample_id VARCHAR(20) NOT NULL,
    sampling_end_date DATE,
    sampling_start_date DATE,
    reconciliation_id VARCHAR(40),
    sample_first_reported_date DATE,
    sample_last_reported_date DATE,
    sar_id INTEGER,
    contaminant_code VARCHAR(4),
    result_sign_code VARCHAR(1),
    sample_measure DECIMAL,
    unit_of_measure VARCHAR(4),
    sar_first_reported_date DATE,
    sar_last_reported_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(submission_year_quarter, pwsid, sample_id),
    FOREIGN KEY (submission_year_quarter, pwsid) 
        REFERENCES public_water_systems(submission_year_quarter, pwsid)
);

-- Site visits
CREATE TABLE IF NOT EXISTS site_visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_year_quarter VARCHAR(7) NOT NULL,
    pwsid VARCHAR(9) NOT NULL,
    visit_id VARCHAR(20) NOT NULL,
    visit_date DATE,
    agency_type_code VARCHAR(2),
    visit_reason_code VARCHAR(4),
    management_ops_eval_code VARCHAR(1),
    source_water_eval_code VARCHAR(1),
    security_eval_code VARCHAR(1),
    pumps_eval_code VARCHAR(1),
    other_eval_code VARCHAR(1),
    compliance_eval_code VARCHAR(1),
    data_verification_eval_code VARCHAR(1),
    treatment_eval_code VARCHAR(1),
    finished_water_stor_eval_code VARCHAR(1),
    distribution_eval_code VARCHAR(1),
    financial_eval_code VARCHAR(1),
    visit_comments TEXT,
    first_reported_date DATE,
    last_reported_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(submission_year_quarter, pwsid, visit_id),
    FOREIGN KEY (submission_year_quarter, pwsid) 
        REFERENCES public_water_systems(submission_year_quarter, pwsid)
);

-- Events and milestones
CREATE TABLE IF NOT EXISTS events_milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_year_quarter VARCHAR(7) NOT NULL,
    pwsid VARCHAR(9) NOT NULL,
    event_schedule_id VARCHAR(20) NOT NULL,
    event_end_date DATE,
    event_actual_date DATE,
    event_comments_text TEXT,
    event_milestone_code VARCHAR(4),
    event_reason_code VARCHAR(4),
    first_reported_date DATE,
    last_reported_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(submission_year_quarter, pwsid, event_schedule_id),
    FOREIGN KEY (submission_year_quarter, pwsid) 
        REFERENCES public_water_systems(submission_year_quarter, pwsid)
);

-- Public notification violations association
CREATE TABLE IF NOT EXISTS pn_violation_assoc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_year_quarter VARCHAR(7) NOT NULL,
    pwsid VARCHAR(9) NOT NULL,
    pn_violation_id VARCHAR(20) NOT NULL,
    related_violation_id VARCHAR(20),
    non_compl_per_begin_date DATE,
    non_compl_per_end_date DATE,
    violation_code VARCHAR(4),
    contamination_code VARCHAR(4),
    first_reported_date DATE,
    last_reported_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(submission_year_quarter, pwsid, pn_violation_id),
    FOREIGN KEY (submission_year_quarter, pwsid) 
        REFERENCES public_water_systems(submission_year_quarter, pwsid)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_pws_pwsid ON public_water_systems(pwsid);
CREATE INDEX IF NOT EXISTS idx_pws_state_code ON public_water_systems(state_code);
CREATE INDEX IF NOT EXISTS idx_pws_type ON public_water_systems(pws_type_code);
CREATE INDEX IF NOT EXISTS idx_pws_population ON public_water_systems(population_served_count);
CREATE INDEX IF NOT EXISTS idx_pws_activity ON public_water_systems(pws_activity_code);

-- Violation indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_violations_pwsid ON violations_enforcement(pwsid);
CREATE INDEX IF NOT EXISTS idx_violations_status ON violations_enforcement(violation_status);
CREATE INDEX IF NOT EXISTS idx_violations_health_based ON violations_enforcement(is_health_based_ind);
CREATE INDEX IF NOT EXISTS idx_violations_category ON violations_enforcement(violation_category_code);
CREATE INDEX IF NOT EXISTS idx_violations_begin_date ON violations_enforcement(non_compl_per_begin_date);
CREATE INDEX IF NOT EXISTS idx_violations_year ON violations_enforcement(EXTRACT(YEAR FROM non_compl_per_begin_date));

-- Geographic indexes
CREATE INDEX IF NOT EXISTS idx_geo_areas_pwsid ON geographic_areas(pwsid);
CREATE INDEX IF NOT EXISTS idx_geo_areas_county ON geographic_areas(county_served);
CREATE INDEX IF NOT EXISTS idx_geo_areas_zip ON geographic_areas(zip_code_served);

-- Site visit indexes
CREATE INDEX IF NOT EXISTS idx_site_visits_pwsid ON site_visits(pwsid);
CREATE INDEX IF NOT EXISTS idx_site_visits_date ON site_visits(visit_date);

-- Reference table indexes
CREATE INDEX IF NOT EXISTS idx_ref_codes_type ON reference_codes(value_type);
CREATE INDEX IF NOT EXISTS idx_ref_codes_lookup ON reference_codes(value_type, value_code);

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Current violations summary by system
CREATE OR REPLACE VIEW current_violations_summary AS
SELECT 
    p.pwsid,
    p.pws_name,
    p.pws_type_code,
    p.population_served_count,
    p.state_code,
    COUNT(v.violation_id) as total_violations,
    COUNT(CASE WHEN v.is_health_based_ind = 'Y' THEN 1 END) as health_violations,
    COUNT(CASE WHEN v.violation_status = 'Unaddressed' THEN 1 END) as unaddressed_violations,
    COUNT(CASE WHEN v.violation_status = 'Resolved' THEN 1 END) as resolved_violations,
    MAX(v.non_compl_per_begin_date) as latest_violation_date
FROM public_water_systems p
LEFT JOIN violations_enforcement v ON p.pwsid = v.pwsid AND p.submission_year_quarter = v.submission_year_quarter
GROUP BY p.pwsid, p.pws_name, p.pws_type_code, p.population_served_count, p.state_code;

-- System health dashboard view
CREATE OR REPLACE VIEW system_health_dashboard AS
SELECT 
    p.pwsid,
    p.pws_name,
    p.pws_type_code,
    p.population_served_count,
    g.county_served,
    g.city_served,
    CASE 
        WHEN COUNT(CASE WHEN v.is_health_based_ind = 'Y' AND v.violation_status = 'Unaddressed' THEN 1 END) > 0 THEN 'RED'
        WHEN COUNT(CASE WHEN v.is_health_based_ind = 'Y' THEN 1 END) > 0 THEN 'YELLOW'
        ELSE 'GREEN'
    END as health_status,
    COUNT(CASE WHEN v.is_health_based_ind = 'Y' AND v.violation_status = 'Unaddressed' THEN 1 END) as critical_violations,
    COUNT(CASE WHEN v.violation_status = 'Unaddressed' THEN 1 END) as total_unaddressed
FROM public_water_systems p
LEFT JOIN violations_enforcement v ON p.pwsid = v.pwsid AND p.submission_year_quarter = v.submission_year_quarter
LEFT JOIN geographic_areas g ON p.pwsid = g.pwsid AND p.submission_year_quarter = g.submission_year_quarter AND g.area_type_code = 'CN'
WHERE p.pws_activity_code = 'A'
GROUP BY p.pwsid, p.pws_name, p.pws_type_code, p.population_served_count, g.county_served, g.city_served;

-- Violation trends by year
CREATE OR REPLACE VIEW violation_trends AS
SELECT 
    EXTRACT(YEAR FROM non_compl_per_begin_date) as violation_year,
    COUNT(*) as total_violations,
    COUNT(CASE WHEN is_health_based_ind = 'Y' THEN 1 END) as health_violations,
    COUNT(CASE WHEN violation_status = 'Unaddressed' THEN 1 END) as unaddressed_violations
FROM violations_enforcement 
WHERE non_compl_per_begin_date IS NOT NULL
GROUP BY EXTRACT(YEAR FROM non_compl_per_begin_date)
ORDER BY violation_year;

-- County-level summary for geographic visualizations
CREATE OR REPLACE VIEW county_summary AS
SELECT 
    g.county_served,
    g.state_served,
    COUNT(DISTINCT p.pwsid) as total_systems,
    SUM(p.population_served_count) as total_population,
    COUNT(CASE WHEN v.is_health_based_ind = 'Y' AND v.violation_status = 'Unaddressed' THEN 1 END) as critical_violations,
    COUNT(v.violation_id) as total_violations
FROM geographic_areas g
JOIN public_water_systems p ON g.pwsid = p.pwsid AND g.submission_year_quarter = p.submission_year_quarter
LEFT JOIN violations_enforcement v ON p.pwsid = v.pwsid AND p.submission_year_quarter = v.submission_year_quarter
WHERE g.area_type_code = 'CN'
GROUP BY g.county_served, g.state_served;

-- ============================================================================
-- ROW LEVEL SECURITY (Optional - for multi-tenant access)
-- ============================================================================

-- Enable RLS on sensitive tables
ALTER TABLE public_water_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE violations_enforcement ENABLE ROW LEVEL SECURITY;

-- Example policy for public read access
CREATE POLICY "Public systems are readable by everyone" ON public_water_systems
    FOR SELECT USING (true);

CREATE POLICY "Public violations are readable by everyone" ON violations_enforcement
    FOR SELECT USING (true);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_pws_updated_at BEFORE UPDATE ON public_water_systems
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_violations_updated_at BEFORE UPDATE ON violations_enforcement
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public_water_systems IS 'Main table for Georgia public water systems from SDWIS';
COMMENT ON TABLE violations_enforcement IS 'Water quality violations and enforcement actions';
COMMENT ON TABLE geographic_areas IS 'Geographic service areas for water systems';
COMMENT ON TABLE violations_enforcement IS 'Water quality violations with enforcement data - key table for public health dashboard';
COMMENT ON VIEW system_health_dashboard IS 'Real-time health status view for public dashboard with red/yellow/green indicators';
COMMENT ON VIEW current_violations_summary IS 'Summary statistics for operator dashboards'; 