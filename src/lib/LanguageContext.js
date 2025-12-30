'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

const translations = {
    ar: {
        // Sidebar & Navigation
        nav_home: 'الرئيسية',
        nav_scan: 'محطة المسح',
        nav_customers: 'العملاء',
        nav_cards: 'البطاقات',
        nav_discounts: 'الخصومات',
        nav_transactions: 'سجل العمليات',
        nav_logs: 'سجل الرقابة',
        nav_management: 'الإدارة',
        nav_settings: 'الإعدادات',
        logout: 'تسجيل الخروج',
        welcome: 'مرحباً',

        // Generic Actions
        add: 'إضافة',
        edit: 'تعديل',
        delete: 'حذف',
        save: 'حفظ',
        cancel: 'إلغاء',
        search: 'بحث...',
        loading: 'جاري التحميل...',
        no_data: 'لا توجد بيانات متاحة',
        actions: 'العمليات',
        status: 'الحالة',
        is_active: 'نشط',
        all_branches: 'جميع الفروع',

        // Management Page
        enterprise_management: 'إدارة المؤسسة',
        enterprise_desc: 'إدارة الفروع، أجهزة الكاشير والربط السحابي',
        tabs_branches: 'الفروع',
        tabs_terminals: 'الأجهزة',
        add_branch: 'إضافة فرع جديد',
        add_terminal: 'تسجيل جهاز كاشير',
        branch_name: 'اسم الفرع',
        branch_location: 'الموقع',
        terminal_name: 'اسم الجهاز',
        terminal_secret: 'المفتاح السري',
        terminal_branch: 'الفرع التابع له',
        connection_status: 'حالة الاتصال',

        // Customers & Cards
        customer_name: 'الاسم',
        customer_phone: 'الهاتف',
        customer_email: 'البريد الإلكتروني',
        customer_points: 'النقاط',
        card_uid: 'رقم البطاقة (UID)',
        register_customer: 'تسجيل عميل جديد',
        link_card: 'ربط بطاقة',

        // Scan Terminal
        waiting_card: 'في انتظار البطاقة',
        scan_desc: 'قم بوضع بطاقة NFC على القارئ للتعرف على العميل وتطبيق الخصم.',
        realtime_enabled: 'البث الفوري مفعل',
        connected: 'متصل',
        disconnected: 'غير متصل',
        processing: 'جاري المعالجة...',

        // Transactions
        amount: 'المبلغ',
        amount_after: 'المبلغ بعد الخصم',
        date: 'التاريخ',
        discount: 'الخصم',
        checkout: 'إتمام العملية',
        invoice_val: 'قيمة الفاتورة',

        // Discounts
        discount_name: 'اسم العرض',
        discount_type: 'نوع الخصم',
        discount_value: 'القيمة',
        discount_points: 'النقاط المطلوبة',
        discount_start: 'تاريخ البدء',
        discount_end: 'تاريخ الانتهاء',
        add_discount: 'إنشاء عروض جديدة',
        percentage: 'نسبة مئوية',
        fixed_amount: 'مبلغ ثابت',
        gift: 'هدية مجانية',
        // User Management
        user_management: 'إدارة المستخدمين',
        tabs_users: 'المستخدمين',
        add_user: 'إضافة مستخدم جديد',
        role: 'الدور',
        username: 'اسم المستخدم',
        password: 'كلمة المرور',
        admin: 'مسؤول',
        staff: 'موظف',
    },
    en: {
        // Sidebar & Navigation
        nav_home: 'Home',
        nav_scan: 'Scan Terminal',
        nav_customers: 'Customers',
        nav_cards: 'Cards',
        nav_discounts: 'Discounts',
        nav_transactions: 'Transactions',
        nav_logs: 'Audit Logs',
        nav_management: 'Management',
        nav_settings: 'Settings',
        logout: 'Logout',
        welcome: 'Welcome',

        // Generic Actions
        add: 'Add',
        edit: 'Edit',
        delete: 'Delete',
        save: 'Save',
        cancel: 'Cancel',
        search: 'Search...',
        loading: 'Loading...',
        no_data: 'No data available',
        actions: 'Actions',
        status: 'Status',
        is_active: 'Active',
        all_branches: 'All Branches',

        // Management Page
        enterprise_management: 'Enterprise Management',
        enterprise_desc: 'Manage branches, cashier terminals and cloud sync',
        tabs_branches: 'Branches',
        tabs_terminals: 'Terminals',
        add_branch: 'Add New Branch',
        add_terminal: 'Register Terminal',
        branch_name: 'Branch Name',
        branch_location: 'Location',
        terminal_name: 'Terminal Name',
        terminal_secret: 'Secret Key',
        terminal_branch: 'Linked Branch',
        connection_status: 'Connection Status',

        // Customers & Cards
        customer_name: 'Name',
        customer_phone: 'Phone',
        customer_email: 'Email',
        customer_points: 'Points',
        card_uid: 'Card UID',
        register_customer: 'Register Customer',
        link_card: 'Link Card',

        // Scan Terminal
        waiting_card: 'Waiting for Card',
        scan_desc: 'Place the NFC card on the reader to identify the customer and apply discounts.',
        realtime_enabled: 'Realtime Sync Enabled',
        connected: 'Connected',
        disconnected: 'Disconnected',
        processing: 'Processing...',

        // Transactions
        amount: 'Amount',
        amount_after: 'Amount After Discount',
        date: 'Date',
        discount: 'Discount',
        checkout: 'Checkout',
        invoice_val: 'Invoice Value',

        // Discounts
        discount_name: 'Offer Name',
        discount_type: 'Type',
        discount_value: 'Value',
        discount_points: 'Points Required',
        discount_start: 'Start Date',
        discount_end: 'End Date',
        add_discount: 'Create New Offer',
        percentage: 'Percentage',
        fixed_amount: 'Fixed Amount',
        gift: 'Gift/Freebie',
        // User Management
        user_management: 'User Management',
        tabs_users: 'Users',
        add_user: 'Add New User',
        role: 'Role',
        username: 'Username',
        password: 'Password',
        admin: 'Admin',
        staff: 'Staff',
    }
};

export function LanguageProvider({ children }) {
    const [language, setLanguage] = useState('ar');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const savedLang = localStorage.getItem('app_lang') || 'ar';
        setLanguage(savedLang);
        setMounted(true);
    }, []);

    useEffect(() => {
        if (mounted) {
            localStorage.setItem('app_lang', language);
            document.dir = language === 'ar' ? 'rtl' : 'ltr';
            document.lang = language;
        }
    }, [language, mounted]);

    const t = (key) => {
        return translations[language][key] || key;
    };

    const toggleLanguage = () => {
        setLanguage(prev => prev === 'ar' ? 'en' : 'ar');
    };

    if (!mounted) return null;

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t, toggleLanguage, dir: language === 'ar' ? 'rtl' : 'ltr' }}>
            {children}
        </LanguageContext.Provider>
    );
}

export const useLanguage = () => useContext(LanguageContext);
