# NFC Discount System

نظام متكامل لإدارة الخصومات والولاء باستخدام تقنية NFC (Near Field Communication).

## 🌟 المميزات

- ✅ **مصادقة آمنة** - JWT tokens مع httpOnly cookies
- ✅ **نظام نقاط الولاء** - تتبع وإدارة نقاط العملاء
- ✅ **قارئ NFC** - دعم قراءة بطاقات NFC عبر WebSocket
- ✅ **إدارة الخصومات** - خصومات نسبية، ثابتة، وهدايا
- ✅ **تقارير وإحصائيات** - لوحة تحكم شاملة
- ✅ **Rate Limiting** - حماية من الهجمات
- ✅ **Audit Logs** - تتبع جميع العمليات الإدارية
- ✅ **Caching Layer** - أداء محسّن
- ✅ **Structured Logging** - تتبع شامل للأحداث

## 📋 المتطلبات

- Node.js v18+ 
- MySQL 8.0+
- قارئ NFC متوافق مع PC/SC (اختياري)

## 🚀 التثبيت السريع

```bash
# 1. Clone المشروع
git clone <repository-url>
cd nfc-discount-frontend

# 2. تثبيت الحزم
npm install

# 3. إعداد قاعدة البيانات
mysql -u root -p -e "CREATE DATABASE nfc_discount_system;"
mysql -u root -p nfc_discount_system < database/schema.sql
mysql -u root -p nfc_discount_system < database/migrations/001_add_indexes.sql

# 4. إعداد البيئة
cp .env.example .env
# قم بتعديل .env وتعيين JWT_SECRET

# 5. إنشاء المسؤول الأول
node scripts/create-admin.js

# 6. تشغيل التطبيق
npm run dev
```

التطبيق سيعمل على: `http://localhost:3000`

## 🔐 الأمان

### الميزات الأمنية المطبقة

- 🔒 **JWT Authentication** - مفتاح سري قوي إلزامي
- 🔒 **Rate Limiting** - حماية شاملة من الهجمات
- 🔒 **Security Headers** - CSP, X-Frame-Options, HSTS
- 🔒 **SQL Injection Protection** - Prepared statements
- 🔒 **Password Hashing** - bcrypt
- 🔒 **SSL/TLS** - آمن في الإنتاج
- 🔒 **Audit Logging** - تتبع جميع العمليات
- 🔒 **Input Validation** - Zod schemas

## 📚 التوثيق الكامل

للتوثيق الشامل، راجع الملفات التالية:
- [دليل التثبيت الكامل](docs/installation.md)
- [API Documentation](docs/api.md)
- [دليل النشر](docs/deployment.md)
- [استكشاف الأخطاء](docs/troubleshooting.md)

## 🎯 الاستخدام السريع

### تسجيل الدخول
```
URL: http://localhost:3000/login
Username: admin (أو ما قمت بإنشائه)
Password: your_password
```

### لوحة التحكم
```
URL: http://localhost:3000/dashboard
```

### API Endpoints
```
POST /api/auth/login
POST /api/customers
POST /api/cards
POST /api/transactions
POST /api/scan
```

## 🔧 البنية التقنية

- **Frontend**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS
- **Database**: MySQL 8.0+
- **Authentication**: JWT + httpOnly Cookies
- **Validation**: Zod
- **Charts**: Recharts
- **NFC**: WebSocket + PC/SC

## 📊 الأداء

- ⚡ **Caching**: In-memory cache مع TTL
- ⚡ **Database Indexes**: محسّن للاستعلامات السريعة
- ⚡ **Rate Limiting**: حماية الموارد
- ⚡ **Optimized Queries**: استعلامات محسّنة

## 🤝 المساهمة

نرحب بالمساهمات! يرجى:
1. Fork المشروع
2. إنشاء branch للميزة الجديدة
3. Commit التغييرات
4. Push للـ branch
5. فتح Pull Request

## 📝 الترخيص

ISC License

## 📞 الدعم

للمشاكل والاستفسارات، يرجى فتح Issue في GitHub.

---

**الإصدار:** 2.0.0  
**آخر تحديث:** ديسمبر 2025  
**الحالة:** ✅ جاهز للإنتاج
