# 🚰 Georgia Water Quality Regulator Dashboard

A comprehensive Next.js dashboard designed for water quality regulators to monitor, assess, and prioritize compliance across Georgia's public water systems.

## 🎯 **Built for Regulators**

This dashboard addresses the critical needs identified in Georgia's water quality oversight challenge, focusing on **regulatory oversight and compliance monitoring**.

### **Dashboard Features**

#### **📊 Executive Overview (Perfect for Meetings)**
- **Statewide Metrics**: Total systems, critical violations, population at risk
- **Health Status Distribution**: Red/Yellow/Green system categorization
- **County Risk Heatmap**: Visual identification of high-risk areas
- **Real-time Connection Status**: Database connectivity monitoring

#### **🔍 Drill-Down Interface**
- **Counties Tab**: Compliance summary by county with risk indicators
- **Critical Systems Tab**: Immediate attention priorities
- **Trends Tab**: Historical violation patterns for resource planning

#### **⚡ Quick Showcase Features**
- Clean, presentation-ready design for stakeholder meetings
- Responsive layout works on tablets for field use
- Color-coded risk indicators for instant assessment
- Professional styling with ShadCN UI components

## 🏗️ **Technical Architecture**

### **Stack**
- **Frontend**: Next.js 15 with TypeScript
- **UI**: ShadCN UI + Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Charts**: Recharts
- **Icons**: Lucide React

### **Database Integration**
- Connects to local Supabase instance (`http://localhost:54321`)
- Uses optimized views: `system_health_dashboard`, `county_summary`, `violation_trends`
- Robust error handling with fallback data
- Connection status monitoring

## 🚀 **Getting Started**

1. **Prerequisites**
   ```bash
   # Ensure Supabase is running locally
   cd ../.. && supabase start
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Run Development Server**
   ```bash
   npm run dev
   ```

4. **View Dashboard**
   - Open [http://localhost:3000](http://localhost:3000)
   - Dashboard loads with real Georgia water system data

## 📋 **Dashboard Sections**

### **Overview Tab**
- System health status pie chart
- County-level risk bar chart
- Executive summary metrics

### **Counties Tab**
- Sortable table of all Georgia counties
- Risk level indicators
- Population and violation counts
- Clickable rows for future drill-down

### **Critical Systems Tab**
- Water systems requiring immediate attention
- Health-based violation priorities
- Population impact assessment

### **Trends Tab**
- Historical violation patterns
- Year-over-year analysis
- Resource allocation insights

## 🎨 **Design Philosophy**

**Meeting-Ready**: Clean, professional interface perfect for regulator presentations
**Action-Oriented**: Red/Yellow/Green health indicators for immediate decision-making  
**Data-Driven**: Real metrics from Georgia's SDWIS data
**Responsive**: Works on desktop, tablet, and mobile devices

## 🔍 **Key Insights Enabled**

1. **Resource Prioritization**: Which counties need immediate attention?
2. **Population Impact**: How many Georgians are affected by violations?
3. **Trend Analysis**: Are violations increasing or decreasing?
4. **System Health**: Quick visual assessment of statewide compliance

## 🚀 **Perfect for Speed Trials**

This dashboard demonstrates:
- **Fast Implementation**: Built using modern AI-assisted development
- **Real Data Integration**: Connects to actual Georgia water system database
- **Production-Ready**: Professional UI with error handling
- **Scalable Architecture**: Modular design for easy extension

---

Built for the **Codegen Speed Trials 2025** - transforming Georgia's water quality oversight from static spreadsheets to dynamic, actionable intelligence.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
