import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import pool from '@/lib/db';
import { ShieldAlert } from 'lucide-react';

export default async function LogsPage() {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        redirect('/dashboard');
    }

    // Fetch logs with admin username
    const [logs] = await pool.query(`
        SELECT l.*, u.username 
        FROM audit_logs l 
        JOIN users u ON l.admin_id = u.id 
        ORDER BY l.created_at DESC 
        LIMIT 100
    `);

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
                <ShieldAlert className="text-red-600" size={32} />
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">System Audit Logs</h1>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 uppercase font-medium border-b border-gray-100 dark:border-gray-700">
                            <tr>
                                <th className="px-6 py-4">Time</th>
                                <th className="px-6 py-4">Admin</th>
                                <th className="px-6 py-4">Action</th>
                                <th className="px-6 py-4">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                                        No audit logs found.
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                                            {new Date(log.created_at).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                            <span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">
                                                {log.username}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                                                ${log.action_type.includes('DELETE') ? 'bg-red-100 text-red-800' :
                                                    log.action_type.includes('UPDATE') ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                                                {log.action_type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 dark:text-gray-300 max-w-md truncate font-mono text-xs" title={log.details}>
                                            {log.details}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
