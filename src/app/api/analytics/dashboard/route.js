import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // 1. Check Authentication
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        // 2. Fetch Aggregated Stats
        let stats;
        try {
            const { data, error: rpcError } = await supabase.rpc('get_dashboard_stats');
            if (rpcError) throw rpcError;

            // Format RPC data for frontend
            stats = {
                ...data,
                chartData: (data.chartData || []).map(day => ({
                    date: new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }),
                    fullDate: day.date,
                    count: parseInt(day.count)
                }))
            };
        } catch (err) {
            console.warn('RPC get_dashboard_stats failed or not found, using legacy fallback logic.', err.message);

            const [
                { count: totalCustomers, error: customersError },
                { count: totalPackages, error: packagesError },
                { count: totalTransactions, error: txError },
                { data: recentActivity, error: activityError },
                { data: chartData, error: chartError }
            ] = await Promise.all([
                supabase.from('customers').select('*', { count: 'exact', head: true }),
                supabase.from('customer_coupons').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
                supabase.from('points_ledger').select('*', { count: 'exact', head: true }),
                supabase.from('points_ledger')
                    .select(`id, points, reason, created_at, customers ( full_name )`)
                    .order('created_at', { ascending: false })
                    .limit(5),
                supabase.from('points_ledger')
                    .select('created_at')
                    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
            ]);

            if (customersError || txError || activityError || packagesError || chartError) throw new Error('Legacy fallback failed');

            const days = {};
            for (let i = 6; i >= 0; i--) {
                const d = new Date(); d.setDate(d.getDate() - i);
                days[d.toISOString().split('T')[0]] = 0;
            }
            chartData.forEach(row => {
                const dateStr = row.created_at.split('T')[0];
                if (days[dateStr] !== undefined) days[dateStr]++;
            });

            stats = {
                totalCustomers: totalCustomers || 0,
                totalPoints: totalPackages || 0,
                totalTransactions: totalTransactions || 0,
                recentActivity: recentActivity || [],
                chartData: Object.entries(days).map(([date, count]) => ({
                    date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
                    fullDate: date,
                    count
                }))
            };
        }

        return NextResponse.json({ data: stats });

    } catch (error) {
        console.error('Dashboard Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
