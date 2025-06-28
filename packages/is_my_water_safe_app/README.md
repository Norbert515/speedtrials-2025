# 🚰 Is My Water Safe? - Georgia Water Quality App

A Flutter application that provides easy access to Georgia's public water quality data, transforming complex SDWIS data into actionable information for the public, water system operators, and regulators.

## 🚀 Quick Start

### Prerequisites
- Flutter SDK (3.8.1+)
- Supabase CLI (for local development)
- Your Supabase project (local or cloud)

### 1. **Start Local Supabase** (for development)
```bash
# Navigate to the project root
cd ../..

# Start local Supabase instance
supabase start

# Run database migrations
supabase db reset

# Import water quality data
python scripts/import_data.py
```

### 2. **Install Dependencies**
```bash
flutter pub get
```

### 3. **Run the App**
```bash
# For local development (default)
flutter run

# For production
flutter run --dart-define=PRODUCTION=true
```

## ⚙️ Configuration

The app automatically configures itself based on the environment:

### **Local Development** (default)
- **URL**: `http://localhost:54322`
- **Environment**: Detects local Supabase automatically
- **Debug**: Enabled for detailed logging

### **Production**
Update `lib/config/app_config.dart` with your production values:

```dart
static const AppConfig production = AppConfig._(
  supabaseUrl: 'https://your-project.supabase.co',
  supabaseAnonKey: 'your-production-anon-key',
  environment: AppEnvironment.production,
);
```

Run with: `flutter run --dart-define=PRODUCTION=true`

## 🎯 Features Currently Implemented

### ✅ **App Foundation**
- **Supabase Integration**: Automatic initialization with environment detection
- **Riverpod State Management**: Clean dependency injection
- **Material 3 Design**: Modern, accessible UI
- **Connection Status**: Real-time database connection monitoring

### ✅ **Repository Layer**
- **Type-safe Database Access**: Strongly typed models and queries
- **Pagination Support**: Efficient data loading with 25-100 item limits
- **Search Functionality**: Multi-column text search across water systems
- **Location Filtering**: County, city, and ZIP code queries
- **Error Handling**: Comprehensive exception management

### ✅ **Quick Actions**
- **Test Repository**: Verify database connection and data access
- **System Count**: Get total active water systems
- **Search Demo**: Placeholder for search functionality
- **Database Info**: Environment and connection details

## 📱 App Structure

```
lib/
├── config/
│   └── app_config.dart          # Environment configuration
├── models/                      # Data models
│   └── src/                     # Model implementations
├── providers/
│   └── app_providers.dart       # Riverpod providers
├── repository/
│   ├── base_repository.dart     # Common repository functionality
│   ├── supabase_tables.dart     # Type-safe table definitions
│   └── water_system_repository.dart # Water system data access
├── screens/
│   └── home_screen.dart         # Main home screen
└── main.dart                    # App initialization
```

## 🔧 Development Tips

### **Check Connection Status**
The home screen shows:
- 🟢 **Connected**: Database is accessible
- 🟠 **Local Not Running**: Start Supabase with `supabase start`
- 🔴 **Error**: Check configuration or network

### **Switch Environments**
```bash
# Local development
flutter run

# Production
flutter run --dart-define=PRODUCTION=true
```

### **Debug Database Issues**
1. Check Supabase is running: `supabase status`
2. Verify tables exist: `supabase db status`
3. Test connection in app: Tap "Test Repository"

## 📊 Database Schema

The app expects these main tables:
- `public_water_systems` - Water system details
- `violations_enforcement` - Water quality violations
- `geographic_areas` - Service area locations
- `reference_codes` - Lookup values

See `supabase/migrations/` for complete schema.

## 🔮 Next Steps

Ready to extend? The foundation supports:

### **User Features**
- Search by location or system name
- Red/yellow/green health status indicators
- Violation details with plain-English explanations
- Interactive maps with system locations

### **Technical Features**
- Real-time violation alerts
- Offline support with local caching
- Push notifications for health violations
- Advanced filtering and sorting

### **Data Features**
- Historical trend analysis
- Violation severity scoring
- Compliance tracking
- Geographic clustering

## 🛠 Troubleshooting

### **App won't start**
- Check Flutter version: `flutter --version`
- Clear cache: `flutter clean && flutter pub get`

### **Database connection fails**
- Verify Supabase is running: `supabase status`
- Check URL in `app_config.dart`
- Look for errors in console output

### **No data shows**
- Run data import: `python scripts/import_data.py`
- Check table exists: `supabase db status`
- Verify permissions in Supabase dashboard

## 📝 Environment Variables

For advanced configuration, use `--dart-define`:

```bash
flutter run \
  --dart-define=PRODUCTION=true \
  --dart-define=SUPABASE_URL=your-url \
  --dart-define=SUPABASE_ANON_KEY=your-key
```

---

**🎯 Ready to build something amazing?** The foundation is set - now let's create the best water quality app Georgia has ever seen! 🚰✨
