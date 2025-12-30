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
        // Run queries in parallel for performance
        const [
            { count: totalCustomers, error: customersError },
            { data: pointsData, error: pointsError },
            { count: totalTransactions, error: txError },
            { data: recentActivity, error: activityError },
            { data: chartData, error: chartError }
        ] = await Promise.all([
            // A. Total Customers
            supabase.from('customers').select('*', { count: 'exact', head: true }),

            // B. Total Points Distributed (Sum of positive points in ledger)
            // Note: Supabase doesn't have a simple .sum() via JS client easily efficiently without RPC or fetching all.
            // For now, we will use a workaround or RPC if available. 
            // Workaround: We will use a smaller limit and hopefully we used RPC in production.
            // Actually, let's just fetch all positive entries for now (Small App) or better, assume we have an RPC.
            // If no RPC, let's just count transactions for now to avoid fetching million rows.
            // We'll stick to Total Points Balance of all customers (easier -> sum customers.points_balance)
            supabase.from('customers').select('points_balance'),

            // C. Total Transactions (Ledger entries)
            supabase.from('points_ledger').select('*', { count: 'exact', head: true }),

            // D. Recent Activity (Last 5 ledger entries with customer info)
            supabase.from('points_ledger')
                .select(`
                    id,
                    points,
                    reason,
                    created_at,
                    customers ( full_name )
                `)
                .order('created_at', { ascending: false })
                .limit(5),

            // E. Chart Data (Last 7 Days) - We need to aggregate this in code if no RPC
            supabase.from('points_ledger')
                .select('created_at')
                .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        ]);

        if (customersError || txError || activityError || pointsError || chartError) {
            console.error('Analytics Fetch Error', { customersError, txError });
            throw new Error('Failed to fetch analytics data');
        }

        // Calculate Total Points (Sum of current balances)
        const totalPoints = pointsData.reduce((sum, c) => sum + (c.points_balance || 0), 0);

        // Process Chart Data (Group by Day)
        const days = {};
        // Initialize last 7 days with 0
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            days[dateStr] = 0;
        }

        chartData.forEach(row => {
            const dateStr = row.created_at.split('T')[0];
            if (days[dateStr] !== undefined) {
                days[dateStr]++;
            }
        });

        const formattedChartData = Object.entries(days).map(([date, count]) => ({
            date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }), // e.g., Mon, Tue
            fullDate: date,
            count
        }));

        return NextResponse.json({
            data: {
                totalCustomers: totalCustomers || 0,
                totalPoints,
                totalTransactions: totalTransactions || 0,
                recentActivity: recentActivity || [],
                chartData: formattedChartData
            }
        });

    } catch (error) {
        console.error('Dashboard Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
