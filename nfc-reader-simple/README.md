# Remote NFC Reader - Supabase Edition

قارئ NFC عن بُعد - يعمل على **أي جهاز** ويرسل البيانات لكل الأجهزة الأخرى فوراً!

## ✨ المميزات

- ✅ **Remote**: اقرأ البطاقات من أي جهاز
- ✅ **Realtime**: كل الأجهزة تستقبل البيانات فوراً
- ✅ **No API needed**: يكتب مباشرة في Supabase
- ✅ **Multi-device**: شغل على عدة أجهزة في نفس الوقت

## التثبيت السريع

### 1. تثبيت Node.js
قم بتحميل وتثبيت Node.js من: https://nodejs.org

### 2. الإعداد
1. انسخ ملف `.env.example` إلى `.env`
2. افتح `.env` وعدل القيم:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=your_service_role_key
   TERMINAL_ID=15
   ```

**للحصول على Supabase Keys:**
1. اذهب لـ [Supabase Dashboard](https://supabase.com/dashboard)
2. اختر مشروعك
3. Settings → API
4. انسخ:
   - `URL` → `SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_KEY`

### 3. التشغيل

#### على Windows:
```bash
cd nfc-reader-simple
npm install
START.bat
```

#### على macOS:
```bash
cd nfc-reader-simple
npm install
./START.command
```

## كيف يعمل؟

```
[جهاز 1: القارئ] → [Supabase] → [جهاز 2: Dashboard]
                              ↓
                         [جهاز 3: Dashboard]
                              ↓
                         [جهاز 4: Dashboard]
```

1. ✅ الجهاز الأول يقرأ البطاقة
2. ✅ يكتب في جدول `scan_events`
3. ✅ **كل** الأجهزة الأخرى تستقبل التحديث **فوراً** عبر Realtime

## الأمان

- ✅ لا توجد مفاتيح سرية في الكود
- ✅ كل الإعدادات في ملف `.env` (محلي فقط)
- ✅ ملف `.env` محمي من Git تلقائياً
- ✅ يستخدم `service_role` key للوصول الكامل

## استكشاف الأخطاء

### "Missing configuration"?
تأكد من أن ملف `.env` موجود ويحتوي على:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `TERMINAL_ID`

### القارئ لا يعمل على Windows?
تأكد من تثبيت تعريف القارئ من موقع الشركة المصنعة.

### القارئ لا يعمل على macOS?
```bash
sudo pkill -9 com.apple.ifdreader
```

### لا يظهر في Dashboard?
تأكد من أن Dashboard مفتوح على صفحة Scan وأن Realtime يعمل.

## الدعم

إذا واجهت أي مشكلة، تحقق من:
1. Node.js مثبت: `node --version`
2. ملف `.env` صحيح
3. القارئ متصل بالجهاز
4. Supabase Keys صحيحة
