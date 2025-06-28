"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  AlertTriangle,
  Users,
  MapPin,
  Phone,
  Mail,
  XCircle,
  Building,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ViolationCard, ViolationCardData } from "@/components/ViolationCard";

interface SystemDetail {
  pwsid: string;
  pws_name: string;
  pws_type_code: string;
  population_served_count: number;
  pws_activity_code: string;
  org_name: string;
  admin_name: string;
  email_addr: string;
  phone_number: string;
  address_line1: string;
  address_line2: string;
  city_name: string;
  zip_code: string;
  state_code: string;
  primacy_agency_code: string;
  owner_type_code: string;
  first_reported_date: string;
  last_reported_date: string;
}

interface SystemViolation {
  violation_id: string;
  violation_code: string;
  violation_category_code: string;
  is_health_based_ind: string;
  violation_status: string;
  non_compl_per_begin_date: string;
  non_compl_per_end_date: string;
  contaminant_code: string;
  public_notification_tier: number;
  viol_measure: number;
  unit_of_measure: string;
}

interface SiteVisit {
  visit_id: string;
  visit_date: string;
  visit_reason_code: string;
  compliance_eval_code: string;
  treatment_eval_code: string;
  visit_comments: string;
}

interface GeographicArea {
  county_served: string;
  city_served: string;
  zip_code_served: string;
  area_type_code: string;
}

export default function SystemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pwsid = params.pwsid as string;

  // Get initial tab from URL or default to "overview"
  const [activeTab, setActiveTab] = useState(() => {
    return searchParams?.get("tab") || "overview";
  });

  const [system, setSystem] = useState<SystemDetail | null>(null);
  const [violations, setViolations] = useState<SystemViolation[]>([]);
  const [siteVisits, setSiteVisits] = useState<SiteVisit[]>([]);
  const [geographicAreas, setGeographicAreas] = useState<GeographicArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to handle tab changes and update URL
  const handleTabChange = (value: string) => {
    setActiveTab(value);

    // Update URL with new tab selection
    const params = new URLSearchParams(searchParams || "");
    params.set("tab", value);
    router.replace(`/systems/${pwsid}?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    if (pwsid) {
      fetchSystemDetails();
    }
  }, [pwsid]);

  const fetchSystemDetails = async () => {
    try {
      setLoading(true);

      // Fetch system details and related data
      const [systemResponse, violationsResponse, visitsResponse, geoResponse] =
        await Promise.all([
          supabase
            .from("public_water_systems")
            .select("*")
            .eq("pwsid", pwsid)
            .single(),
          // Try to get violations with AI explanations first, fall back to basic data
          supabase
            .from("public_violation_explanations")
            .select("*")
            .eq("pwsid", pwsid)
            .order("non_compl_per_begin_date", { ascending: false })
            .then((response) => {
              // If no AI explanations found, get basic violation data
              if (
                response.error ||
                !response.data ||
                response.data.length === 0
              ) {
                return supabase
                  .from("violations_enforcement")
                  .select("*")
                  .eq("pwsid", pwsid)
                  .order("non_compl_per_begin_date", { ascending: false });
              }
              return response;
            }),
          supabase
            .from("site_visits")
            .select("*")
            .eq("pwsid", pwsid)
            .order("visit_date", { ascending: false }),
          supabase.from("geographic_areas").select("*").eq("pwsid", pwsid),
        ]);

      if (systemResponse.error) {
        throw new Error(`System not found: ${systemResponse.error.message}`);
      }

      setSystem(systemResponse.data);
      setViolations(violationsResponse.data || []);
      setSiteVisits(visitsResponse.data || []);
      setGeographicAreas(geoResponse.data || []);
    } catch (error) {
      console.error("Error fetching system details:", error);
      setError(
        error instanceof Error ? error.message : "Failed to load system details"
      );
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString();
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !system) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">System Not Found</h2>
                <p className="text-gray-600">
                  {error || `Water system ${pwsid} could not be found.`}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const healthViolations = violations.filter(
    (v) => v.is_health_based_ind === "Y"
  );
  const unaddressedViolations = violations.filter(
    (v) => v.violation_status === "Unaddressed"
  );
  const recentViolations = violations.slice(0, 5);

  // Get system health status
  const systemHealthStatus =
    unaddressedViolations.filter((v) => v.is_health_based_ind === "Y").length >
    0
      ? "RED"
      : healthViolations.length > 0
        ? "YELLOW"
        : "GREEN";

  const counties = [
    ...new Set(geographicAreas.map((g) => g.county_served).filter(Boolean)),
  ];
  const cities = [
    ...new Set(geographicAreas.map((g) => g.city_served).filter(Boolean)),
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-4">
          {/* Breadcrumb Navigation */}
          <nav className="flex items-center space-x-2 text-sm text-gray-600">
            <button
              onClick={() => router.back()}
              className="flex items-center space-x-1 hover:text-blue-600 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Dashboard</span>
            </button>
            <span>/</span>
            <span>Water Systems</span>
            <span>/</span>
            <span className="text-gray-900 font-medium">{system.pws_name}</span>
          </nav>

          {/* System Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {system.pws_name}
              </h1>
              <p className="text-gray-600">PWSID: {system.pwsid}</p>
            </div>
            <div className="flex items-center space-x-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  systemHealthStatus === "RED"
                    ? "bg-red-500"
                    : systemHealthStatus === "YELLOW"
                      ? "bg-yellow-500"
                      : "bg-green-500"
                }`}
              ></div>
              <span className="text-sm font-medium">
                {systemHealthStatus === "RED"
                  ? "Critical"
                  : systemHealthStatus === "YELLOW"
                    ? "Warning"
                    : "Good"}
              </span>
            </div>
          </div>
        </div>

        {/* System Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Population Served
              </CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatNumber(system.population_served_count || 0)}
              </div>
              <p className="text-xs text-gray-600">Georgians served</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Violations
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{violations.length}</div>
              <p className="text-xs text-gray-600">
                {healthViolations.length} health-based
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unaddressed</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {unaddressedViolations.length}
              </div>
              <p className="text-xs text-gray-600">Require action</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Site Visits</CardTitle>
              <Building className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{siteVisits.length}</div>
              <p className="text-xs text-gray-600">
                Last:{" "}
                {siteVisits[0] ? formatDate(siteVisits[0].visit_date) : "None"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="space-y-4"
        >
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="violations">Violations</TabsTrigger>
            <TabsTrigger value="inspections">Inspections</TabsTrigger>
            <TabsTrigger value="contact">Contact & Service</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* System Information */}
              <Card>
                <CardHeader>
                  <CardTitle>System Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-600">System Type</span>
                      <p className="font-medium">{system.pws_type_code}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">
                        Activity Status
                      </span>
                      <p className="font-medium">
                        {system.pws_activity_code === "A"
                          ? "Active"
                          : "Inactive"}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Owner Type</span>
                      <p className="font-medium">{system.owner_type_code}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">
                        Primacy Agency
                      </span>
                      <p className="font-medium">
                        {system.primacy_agency_code}
                      </p>
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">
                      Service Period
                    </span>
                    <p className="font-medium">
                      {formatDate(system.first_reported_date)} -{" "}
                      {formatDate(system.last_reported_date)}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Violations */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Violations</CardTitle>
                  <CardDescription>
                    Latest 5 violations with AI explanations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recentViolations.length > 0 ? (
                      recentViolations.map((violation) => (
                        <ViolationCard
                          key={violation.violation_id}
                          violation={
                            {
                              ...violation,
                              pwsid: system.pwsid,
                            } as unknown as ViolationCardData
                          }
                          size="compact"
                          showExplanation={false}
                        />
                      ))
                    ) : (
                      <p className="text-gray-600 text-center py-4">
                        No violations on record
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="violations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>All Violations</CardTitle>
                <CardDescription>
                  Complete violation history for this system. Click any
                  violation for detailed AI explanations.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {violations.length > 0 ? (
                    violations.map((violation) => (
                      <ViolationCard
                        key={violation.violation_id}
                        violation={
                          {
                            ...violation,
                            pwsid: system.pwsid,
                          } as unknown as ViolationCardData
                        }
                        size="normal"
                        showExplanation={true}
                      />
                    ))
                  ) : (
                    <p className="text-gray-600 text-center py-8">
                      No violations found for this system
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inspections" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Site Visits & Inspections</CardTitle>
                <CardDescription>Regulatory inspection history</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Compliance</TableHead>
                      <TableHead>Treatment</TableHead>
                      <TableHead>Comments</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {siteVisits.length > 0 ? (
                      siteVisits.map((visit) => (
                        <TableRow key={visit.visit_id}>
                          <TableCell>{formatDate(visit.visit_date)}</TableCell>
                          <TableCell>{visit.visit_reason_code}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                visit.compliance_eval_code === "1"
                                  ? "default"
                                  : "destructive"
                              }
                            >
                              {visit.compliance_eval_code === "1"
                                ? "Pass"
                                : "Fail"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                visit.treatment_eval_code === "1"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {visit.treatment_eval_code === "1"
                                ? "Adequate"
                                : "Review"}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {visit.visit_comments || "No comments"}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center text-gray-600 py-4"
                        >
                          No site visits on record
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contact" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Contact Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <span className="text-sm text-gray-600">Organization</span>
                    <p className="font-medium">
                      {system.org_name || "Not specified"}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Administrator</span>
                    <p className="font-medium">
                      {system.admin_name || "Not specified"}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-gray-600" />
                    <span>{system.phone_number || "No phone number"}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4 text-gray-600" />
                    <span>{system.email_addr || "No email address"}</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <MapPin className="h-4 w-4 text-gray-600 mt-1" />
                    <div>
                      <p>{system.address_line1 || "No address"}</p>
                      {system.address_line2 && <p>{system.address_line2}</p>}
                      <p>
                        {system.city_name}, {system.state_code}{" "}
                        {system.zip_code}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Service Areas */}
              <Card>
                <CardHeader>
                  <CardTitle>Service Areas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <span className="text-sm text-gray-600">
                      Counties Served
                    </span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {counties.length > 0 ? (
                        counties.map((county) => (
                          <Badge key={county} variant="outline">
                            {county}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-gray-500">
                          No counties specified
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Cities Served</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {cities.length > 0 ? (
                        cities.slice(0, 10).map((city) => (
                          <Badge key={city} variant="secondary">
                            {city}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-gray-500">
                          No cities specified
                        </span>
                      )}
                      {cities.length > 10 && (
                        <Badge variant="outline">
                          +{cities.length - 10} more
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
