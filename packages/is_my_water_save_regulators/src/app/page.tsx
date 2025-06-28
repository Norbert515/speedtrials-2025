"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { AlertTriangle, Droplets, Users, TrendingUp } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  supabase,
  SystemHealthDashboard,
  CountySummary,
  ViolationTrend,
} from "@/lib/supabase";

interface DashboardMetrics {
  totalSystems: number;
  activeSystems: number;
  totalViolations: number;
  healthViolations: number;
  unaddressedViolations: number;
  totalPopulationServed: number;
  systemsWithCriticalViolations: number;
  avgViolationsPerSystem: number;
}

const COLORS = {
  RED: "#ef4444",
  YELLOW: "#f59e0b",
  GREEN: "#22c55e",
};

export default function RegulatorDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get initial tab from URL or default to "overview"
  const [activeTab, setActiveTab] = useState(() => {
    return searchParams?.get("tab") || "overview";
  });

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

  const [countySummary, setCountySummary] = useState<CountySummary[]>([]);
  const [violationTrends, setViolationTrends] = useState<ViolationTrend[]>([]);
  const [overallHealthStats, setOverallHealthStats] = useState<{
    red: number;
    yellow: number;
    green: number;
  }>({ red: 0, yellow: 0, green: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dbConnected, setDbConnected] = useState<boolean>(false);

  // Pagination state with lazy loading
  const [currentPage, setCurrentPage] = useState(1);
  const [countyCurrentPage, setCountyCurrentPage] = useState(1);
  const [totalSystemsCount, setTotalSystemsCount] = useState(0);
  const [currentPageSystems, setCurrentPageSystems] = useState<
    SystemHealthDashboard[]
  >([]);
  const [systemsLoading, setSystemsLoading] = useState(false);
  const itemsPerPage = 20;

  // Function to handle tab changes and update URL
  const handleTabChange = (value: string) => {
    setActiveTab(value);

    // Update URL with new tab selection
    const params = new URLSearchParams(searchParams || "");
    params.set("tab", value);
    router.replace(`/?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    fetchSystemsPage(currentPage);
  }, [currentPage]);

  const fetchSystemsPage = async (page: number) => {
    try {
      setSystemsLoading(true);
      const offset = (page - 1) * itemsPerPage;

      // Fetch systems for current page with proper database-level sorting (worst first)
      const [systemsResponse, countResponse] = await Promise.all([
        supabase.rpc("get_systems_sorted", {
          page_offset: offset,
          page_limit: itemsPerPage,
        }),
        // Get total count for pagination
        supabase
          .from("system_health_dashboard")
          .select("*", { count: "exact", head: true }),
      ]);

      if (systemsResponse.error) {
        throw systemsResponse.error;
      }

      const systems = systemsResponse.data || [];

      // Cast systems to proper type and deduplicate if needed
      const typedSystems = systems as SystemHealthDashboard[];
      const uniqueSystems = typedSystems.reduce(
        (acc: SystemHealthDashboard[], current: SystemHealthDashboard) => {
          const existingIndex = acc.findIndex(
            (item: SystemHealthDashboard) => item.pwsid === current.pwsid
          );
          if (existingIndex === -1) {
            acc.push(current);
          } else {
            const existing = acc[existingIndex];
            const severityOrder: Record<string, number> = {
              RED: 3,
              YELLOW: 2,
              GREEN: 1,
            };
            const currentSeverity = severityOrder[current.health_status] || 0;
            const existingSeverity = severityOrder[existing.health_status] || 0;

            if (currentSeverity > existingSeverity) {
              acc[existingIndex] = current;
            }
          }
          return acc;
        },
        [] as SystemHealthDashboard[]
      );

      console.log(
        `🔄 RPC sorting: Got ${systems.length} systems, after dedup: ${uniqueSystems.length}`
      );
      if (systems.length > 0) {
        console.log(
          "🎯 First system health status:",
          systems[0]?.health_status
        );
        console.log(
          "🎯 Systems order by health status:",
          typedSystems
            .map((s: SystemHealthDashboard) => s.health_status)
            .slice(0, 5)
        );
      }

      setCurrentPageSystems(uniqueSystems);
      setTotalSystemsCount(countResponse.count || 0);

      console.log(
        `📄 Loaded page ${page}: ${uniqueSystems.length} systems (${offset + 1}-${offset + uniqueSystems.length} of ${countResponse.count})`
      );
    } catch (error) {
      console.error("Error fetching systems page:", error);
    } finally {
      setSystemsLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch overview metrics using COUNT queries for efficiency
      const [
        totalSystemsResponse,
        activeSystemsResponse,
        totalViolationsResponse,
        healthViolationsResponse,
        unaddressedViolationsResponse,
        populationResponse,
        countyResponse,
        trendsResponse,
        healthStatsRedResponse,
        healthStatsYellowResponse,
        healthStatsGreenResponse,
      ] = await Promise.all([
        // COUNT queries for metrics - much more efficient
        supabase
          .from("public_water_systems")
          .select("*", { count: "exact", head: true }),
        supabase
          .from("public_water_systems")
          .select("*", { count: "exact", head: true })
          .eq("pws_activity_code", "A"),
        supabase
          .from("violations_enforcement")
          .select("*", { count: "exact", head: true }),
        supabase
          .from("violations_enforcement")
          .select("*", { count: "exact", head: true })
          .eq("is_health_based_ind", "Y"),
        supabase
          .from("violations_enforcement")
          .select("*", { count: "exact", head: true })
          .eq("violation_status", "Unaddressed"),
        // Get population sum
        supabase
          .from("public_water_systems")
          .select("population_served_count")
          .eq("pws_activity_code", "A")
          .limit(3000), // Ensure we get all active systems for population calculation
        // County and trends data
        supabase
          .from("county_summary")
          .select("*")
          .order("critical_violations", { ascending: false })
          .limit(50), // Top 50 counties by violations
        supabase
          .from("violation_trends")
          .select("*")
          .order("violation_year", { ascending: true }),
        // Overall health statistics for ALL systems
        supabase
          .from("system_health_dashboard")
          .select("*", { count: "exact", head: true })
          .eq("health_status", "RED"),
        supabase
          .from("system_health_dashboard")
          .select("*", { count: "exact", head: true })
          .eq("health_status", "YELLOW"),
        supabase
          .from("system_health_dashboard")
          .select("*", { count: "exact", head: true })
          .eq("health_status", "GREEN"),
      ]);

      // Debug logging
      console.log("🔍 Dashboard Data Debug:");
      console.log("Total systems count:", totalSystemsResponse.count);
      console.log("Active systems count:", activeSystemsResponse.count);
      console.log("Total violations count:", totalViolationsResponse.count);
      console.log("Health violations count:", healthViolationsResponse.count);
      console.log(
        "Unaddressed violations count:",
        unaddressedViolationsResponse.count
      );
      console.log(
        "County response:",
        countyResponse.data?.length || 0,
        "county records"
      );
      console.log(
        "Trends response:",
        trendsResponse.data?.length || 0,
        "trend records"
      );
      console.log("📊 System data is now loaded lazily per page");

      // Calculate total population from population data
      const totalPopulation =
        populationResponse.data?.reduce(
          (sum, system) => sum + (system.population_served_count || 0),
          0
        ) || 0;

      // Calculate metrics from COUNT queries
      const totalSystems = totalSystemsResponse.count || 0;
      const activeSystems = activeSystemsResponse.count || 0;
      const totalViolations = totalViolationsResponse.count || 0;
      const healthViolations = healthViolationsResponse.count || 0;
      const unaddressedViolations = unaddressedViolationsResponse.count || 0;

      console.log("🚨 Final calculated metrics:");
      console.log("- Total systems:", totalSystems);
      console.log("- Active systems:", activeSystems);
      console.log("- Total violations:", totalViolations);
      console.log("- Health violations:", healthViolations);
      console.log("- Unaddressed violations:", unaddressedViolations);
      console.log("- Total population:", totalPopulation);

      setMetrics({
        totalSystems,
        activeSystems,
        totalViolations,
        healthViolations,
        unaddressedViolations,
        totalPopulationServed: totalPopulation,
        systemsWithCriticalViolations: unaddressedViolations, // Simplified for now
        avgViolationsPerSystem:
          activeSystems > 0 ? totalViolations / activeSystems : 0,
      });

      if (countyResponse.data) setCountySummary(countyResponse.data);
      if (trendsResponse.data) {
        console.log("🔍 RAW TRENDS DATA:", trendsResponse.data);
        trendsResponse.data.forEach((trend: ViolationTrend) => {
          console.log(
            `Year ${trend.violation_year}: Total=${trend.total_violations}, Health=${trend.health_violations}, Unaddressed=${trend.unaddressed_violations}`
          );

          // Validate data logic
          if (trend.health_violations > trend.total_violations) {
            console.error(
              `❌ DATA ERROR: Health violations (${trend.health_violations}) > Total violations (${trend.total_violations}) for year ${trend.violation_year}`
            );
          }
          if (trend.unaddressed_violations > trend.total_violations) {
            console.error(
              `❌ DATA ERROR: Unaddressed violations (${trend.unaddressed_violations}) > Total violations (${trend.total_violations}) for year ${trend.violation_year}`
            );
          }
        });
        setViolationTrends(trendsResponse.data);
      }

      // Set overall health statistics from ALL systems
      setOverallHealthStats({
        red: healthStatsRedResponse.count || 0,
        yellow: healthStatsYellowResponse.count || 0,
        green: healthStatsGreenResponse.count || 0,
      });

      console.log("🏥 OVERALL HEALTH STATS:", {
        red: healthStatsRedResponse.count,
        yellow: healthStatsYellowResponse.count,
        green: healthStatsGreenResponse.count,
        total:
          (healthStatsRedResponse.count || 0) +
          (healthStatsYellowResponse.count || 0) +
          (healthStatsGreenResponse.count || 0),
      });

      setDbConnected(true);
      setError(null);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      setError(
        error instanceof Error ? error.message : "Failed to connect to database"
      );
      setDbConnected(false);
      // Set fallback data so the dashboard still loads
      setMetrics({
        totalSystems: 0,
        activeSystems: 0,
        totalViolations: 0,
        healthViolations: 0,
        unaddressedViolations: 0,
        totalPopulationServed: 0,
        systemsWithCriticalViolations: 0,
        avgViolationsPerSystem: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case "RED":
        return "bg-red-500";
      case "YELLOW":
        return "bg-yellow-500";
      case "GREEN":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
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

  // Debug: Log current page systems
  console.log(
    `📊 Current page ${currentPage}: ${currentPageSystems.length} systems loaded`
  );
  if (currentPageSystems.length > 0) {
    const redSystems = currentPageSystems.filter(
      (s) => s.health_status === "RED"
    );
    if (redSystems.length > 0) {
      console.log(
        "🚨 RED critical systems on this page:",
        redSystems.map(
          (s) =>
            `${s.pws_name} (${s.pwsid}) - ${s.critical_violations} violations`
        )
      );
    }
  }

  // Pagination logic for systems - now using lazy loaded data
  const totalPages = Math.ceil(totalSystemsCount / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalSystemsCount);

  // Pagination logic for counties
  const totalCounties = countySummary.length;
  const totalCountyPages = Math.ceil(totalCounties / itemsPerPage);
  const countyStartIndex = (countyCurrentPage - 1) * itemsPerPage;
  const countyEndIndex = countyStartIndex + itemsPerPage;
  const paginatedCounties = countySummary.slice(
    countyStartIndex,
    countyEndIndex
  );

  // Use overall health statistics from ALL systems in database
  const healthStatusData = [
    {
      name: "Critical (Red)",
      value: overallHealthStats.red,
      color: COLORS.RED,
    },
    {
      name: "Warning (Yellow)",
      value: overallHealthStats.yellow,
      color: COLORS.YELLOW,
    },
    {
      name: "Good (Green)",
      value: overallHealthStats.green,
      color: COLORS.GREEN,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Georgia Water Quality Dashboard
            </h1>
            <p className="text-gray-600">
              Regulatory oversight and compliance monitoring
            </p>
            {error && (
              <div className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-1 rounded">
                Database Error: {error}
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              <div
                className={`w-2 h-2 rounded-full ${dbConnected ? "bg-green-500" : "bg-red-500"}`}
              ></div>
              <span className="text-xs text-gray-600">
                {dbConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
            <Badge variant="outline" className="text-sm">
              Last Updated: {new Date().toLocaleDateString()}
            </Badge>
          </div>
        </div>

        {/* Overview Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Water Systems
              </CardTitle>
              <Droplets className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatNumber(metrics?.totalSystems || 0)}
              </div>
              <p className="text-xs text-gray-600">
                {formatNumber(metrics?.activeSystems || 0)} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Critical Violations
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatNumber(metrics?.unaddressedViolations || 0)}
              </div>
              <p className="text-xs text-gray-600">
                {formatNumber(metrics?.healthViolations || 0)} health-based
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Population Served
              </CardTitle>
              <Users className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatNumber(metrics?.totalPopulationServed || 0)}
              </div>
              <p className="text-xs text-gray-600">Across all active systems</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Avg Violations/System
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(metrics?.avgViolationsPerSystem || 0).toFixed(1)}
              </div>
              <p className="text-xs text-gray-600">Statewide average</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Dashboard Content */}
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="space-y-4"
        >
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="counties">Counties</TabsTrigger>
            <TabsTrigger value="systems">Water Systems</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* System Health Status */}
              <Card>
                <CardHeader>
                  <CardTitle>System Health Status</CardTitle>
                  <CardDescription>
                    Distribution of all{" "}
                    {formatNumber(
                      overallHealthStats.red +
                        overallHealthStats.yellow +
                        overallHealthStats.green
                    )}{" "}
                    active water systems
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={healthStatusData}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {healthStatusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* County Risk Overview */}
              <Card>
                <CardHeader>
                  <CardTitle>Counties by Risk Level</CardTitle>
                  <CardDescription>
                    Critical violations by county
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={countySummary.slice(0, 10)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="county_served"
                          angle={-45}
                          textAnchor="end"
                          height={80}
                        />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="critical_violations" fill="#ef4444" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="counties" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>County Summary</CardTitle>
                <CardDescription>
                  Water system compliance by county. Click any row for detailed
                  county analysis.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>County</TableHead>
                      <TableHead>Systems</TableHead>
                      <TableHead>Population</TableHead>
                      <TableHead>Critical Violations</TableHead>
                      <TableHead>Total Violations</TableHead>
                      <TableHead>Risk Level</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedCounties.map((county) => (
                      <TableRow
                        key={county.county_served}
                        className="cursor-pointer hover:bg-blue-50 transition-colors"
                        title="Click to view county details (coming soon)"
                      >
                        <TableCell className="font-medium">
                          {county.county_served}
                        </TableCell>
                        <TableCell>
                          {formatNumber(county.total_systems)}
                        </TableCell>
                        <TableCell>
                          {formatNumber(county.total_population)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              county.critical_violations > 0
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {county.critical_violations}
                          </Badge>
                        </TableCell>
                        <TableCell>{county.total_violations}</TableCell>
                        <TableCell>
                          <div
                            className={`w-3 h-3 rounded-full ${
                              county.critical_violations > 5
                                ? "bg-red-500"
                                : county.critical_violations > 0
                                  ? "bg-yellow-500"
                                  : "bg-green-500"
                            }`}
                          ></div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* County Pagination Controls */}
                {totalCountyPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-gray-700">
                      Showing {countyStartIndex + 1} to{" "}
                      {Math.min(countyEndIndex, totalCounties)} of{" "}
                      {totalCounties} counties
                    </p>
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() =>
                              setCountyCurrentPage(
                                Math.max(1, countyCurrentPage - 1)
                              )
                            }
                            className={
                              countyCurrentPage === 1
                                ? "pointer-events-none opacity-50"
                                : "cursor-pointer"
                            }
                          />
                        </PaginationItem>

                        {Array.from(
                          { length: Math.min(5, totalCountyPages) },
                          (_, i) => {
                            const pageNum =
                              countyCurrentPage <= 3
                                ? i + 1
                                : countyCurrentPage >= totalCountyPages - 2
                                  ? totalCountyPages - 4 + i
                                  : countyCurrentPage - 2 + i;

                            if (pageNum > totalCountyPages || pageNum < 1)
                              return null;

                            return (
                              <PaginationItem key={pageNum}>
                                <PaginationLink
                                  onClick={() => setCountyCurrentPage(pageNum)}
                                  isActive={countyCurrentPage === pageNum}
                                  className="cursor-pointer"
                                >
                                  {pageNum}
                                </PaginationLink>
                              </PaginationItem>
                            );
                          }
                        )}

                        <PaginationItem>
                          <PaginationNext
                            onClick={() =>
                              setCountyCurrentPage(
                                Math.min(
                                  totalCountyPages,
                                  countyCurrentPage + 1
                                )
                              )
                            }
                            className={
                              countyCurrentPage === totalCountyPages
                                ? "pointer-events-none opacity-50"
                                : "cursor-pointer"
                            }
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="systems" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Water Systems Explorer</CardTitle>
                <CardDescription>
                  All water systems across Georgia, sorted worst to best.
                  Critical RED systems appear first, followed by YELLOW
                  warnings, then GREEN systems. Click any row to view detailed
                  system information.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>System</TableHead>
                      <TableHead>PWSID</TableHead>
                      <TableHead>County</TableHead>
                      <TableHead>Population</TableHead>
                      <TableHead>Health Status</TableHead>
                      <TableHead>Critical Violations</TableHead>
                      <TableHead>Total Unaddressed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {systemsLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <span className="ml-2">Loading systems...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : currentPageSystems.length > 0 ? (
                      currentPageSystems.map((system, index) => (
                        <TableRow
                          key={`system-${system.pwsid}-${index}`}
                          className="cursor-pointer hover:bg-blue-50 transition-colors"
                          onClick={() =>
                            router.push(`/systems/${system.pwsid}`)
                          }
                        >
                          <TableCell className="font-medium">
                            {system.pws_name}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {system.pwsid}
                          </TableCell>
                          <TableCell>
                            {system.county_served || "Unknown"}
                          </TableCell>
                          <TableCell>
                            {formatNumber(system.population_served_count)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <div
                                className={`w-3 h-3 rounded-full ${getHealthStatusColor(system.health_status)}`}
                              ></div>
                              <span className="text-sm">
                                {system.health_status === "RED"
                                  ? "Critical"
                                  : system.health_status === "YELLOW"
                                    ? "Warning"
                                    : "Good"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="w-24 text-center">
                            <div className="inline-flex justify-center min-w-[2rem]">
                              {system.critical_violations > 0 ? (
                                <Badge variant="destructive">
                                  {system.critical_violations}
                                </Badge>
                              ) : (
                                <span className="text-gray-500 px-2 py-1">
                                  0
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="w-24 text-center">
                            <div className="inline-flex justify-center min-w-[2rem]">
                              {system.total_unaddressed > 0 ? (
                                <Badge variant="outline">
                                  {system.total_unaddressed}
                                </Badge>
                              ) : (
                                <span className="text-gray-500 px-2 py-1">
                                  0
                                </span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <div className="space-y-2">
                            {systemsLoading ? (
                              <div className="flex items-center justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                <span className="ml-2">Loading systems...</span>
                              </div>
                            ) : (
                              <p className="text-gray-600">
                                No water systems found for this page
                              </p>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-gray-700">
                      Showing {startIndex + 1} to{" "}
                      {Math.min(endIndex, totalSystemsCount)} of{" "}
                      {totalSystemsCount} systems
                    </p>
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() =>
                              setCurrentPage(Math.max(1, currentPage - 1))
                            }
                            className={
                              currentPage === 1
                                ? "pointer-events-none opacity-50"
                                : "cursor-pointer"
                            }
                          />
                        </PaginationItem>

                        {Array.from(
                          { length: Math.min(5, totalPages) },
                          (_, i) => {
                            const pageNum =
                              currentPage <= 3
                                ? i + 1
                                : currentPage >= totalPages - 2
                                  ? totalPages - 4 + i
                                  : currentPage - 2 + i;

                            if (pageNum > totalPages || pageNum < 1)
                              return null;

                            return (
                              <PaginationItem key={pageNum}>
                                <PaginationLink
                                  onClick={() => setCurrentPage(pageNum)}
                                  isActive={currentPage === pageNum}
                                  className="cursor-pointer"
                                >
                                  {pageNum}
                                </PaginationLink>
                              </PaginationItem>
                            );
                          }
                        )}

                        {totalPages > 5 && currentPage < totalPages - 2 && (
                          <PaginationItem>
                            <PaginationEllipsis />
                          </PaginationItem>
                        )}

                        <PaginationItem>
                          <PaginationNext
                            onClick={() =>
                              setCurrentPage(
                                Math.min(totalPages, currentPage + 1)
                              )
                            }
                            className={
                              currentPage === totalPages
                                ? "pointer-events-none opacity-50"
                                : "cursor-pointer"
                            }
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trends" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Violation Trends</CardTitle>
                <CardDescription>
                  Historical violation patterns over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={violationTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="violation_year"
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        interval="preserveStartEnd"
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis />
                      <Tooltip
                        labelFormatter={(value) => `Year: ${value}`}
                        formatter={(value, name) => [
                          formatNumber(Number(value) || 0),
                          name,
                        ]}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="total_violations"
                        stroke="#8884d8"
                        strokeWidth={2}
                        name="Total Violations"
                        dot={{ fill: "#8884d8", strokeWidth: 2, r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="health_violations"
                        stroke="#ef4444"
                        strokeWidth={2}
                        name="Health-Based Violations"
                        dot={{ fill: "#ef4444", strokeWidth: 2, r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="unaddressed_violations"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        name="Unaddressed Violations"
                        dot={{ fill: "#f59e0b", strokeWidth: 2, r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
