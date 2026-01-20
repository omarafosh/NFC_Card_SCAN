# 🚀 تفعيل ميزة برمجة البطاقات

لتفعيل الميزة بنجاح، يرجى اتباع الخطوات التالية بدقة:

## 1. تحديث قاعدة البيانات (Supabase)
يجب عليك تنفيذ أوامر SQL التالية في لوحة تحكم Supabase لإضافة الجداول والحقول الضرورية.
انسخ الكود أدناه ونفذه في الـ **SQL Editor**:

```sql
-- 1. إضافة التوقيع للبطاقات
ALTER TABLE cards
ADD COLUMN IF NOT EXISTS signature VARCHAR(255),
ADD COLUMN IF NOT EXISTS enrolled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS enrolled_by UUID;

CREATE INDEX IF NOT EXISTS idx_cards_signature ON cards(signature);

-- 2. إنشاء جدول أوامر القارئ
CREATE TABLE IF NOT EXISTS terminal_actions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    terminal_id VARCHAR(255) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    payload JSONB,
    status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

ALTER PUBLICATION supabase_realtime ADD TABLE terminal_actions;

-- 3. إصلاح صلاحيات العملاء
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON customers;
CREATE POLICY "Public profiles are viewable by everyone" 
ON customers FOR SELECT USING (true);
```

## 2. تشغيل القارئ الجديد
القارئ القديم لا يدعم الكتابة. لاستخدام الميزة الجديدة:
1. أغلق أي قارئ NFC مفتوح حالياً.
2. اذهب للمجلد الرئيسي للمشروع.
3. شغل الملف: `run_new_reader_v3.bat`

## 3. تجربة الميزة
1. اذهب إلى صفحة البطاقات في لوحة التحكم.
2. اضغط على زر "برمجة البطاقة" (أيقونة الدرع) بجانب أي بطاقة، أو استخدم الزر العلوي لبرمجة بطاقة جديدة.
3. اتبع التعليمات على الشاشة.
