import React from 'react';
import { TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import Loading from '../components/loading';
import { Game, User } from '../types/game';

type TooltipPayload = {
    color: string;
    dataKey: string;
    value: number;
};

const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CustomTooltip: React.FC<{
    active?: boolean;
    payload?: readonly TooltipPayload[];
    label?: string | number;
}> = ({ active, payload, label }) =>
    active && payload?.length ? (
        <div className="bg-gray-800 p-3 rounded-lg border border-gray-600 shadow-lg">
            <p className="text-white font-medium">{String(label)}</p>
            {payload.map((entry: TooltipPayload, i: number) => (
                    <p key={i} style={{ color: entry.color }} className="text-sm">
                        {entry.dataKey}: {entry.value}
                    </p>
            ))}
        </div>
    ) : null;

const SimplePerformanceChart: React.FC<{ games?: Game[]; user?: User | null }> = ({ games = [], user }) => {
    if (!games || !user) return <Loading />;

    const today = new Date();
    const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(today);
        date.setDate(date.getDate() - (6 - i)); 
        return {
            day: daysOfWeek[date.getDay()],
            date: date.toISOString().split('T')[0],
            wins: 0,
            losses: 0
        };
    });

    games.forEach((g: Game) => {
        try {
            const rawDate = g.date || g.created_at || g.timestamp || g.played_at || g.createdAt;
            const winner_id = g.winner_id ?? g.winnerId ?? g.winner;
            if (!rawDate) return;
            const gameDateStr = new Date(rawDate).toISOString().split('T')[0];
            const dayData = last7Days.find((d: { date: string; day: string; wins: number; losses: number }) => d.date === gameDateStr);
            if (dayData) {
                if (Number(winner_id) === Number(user.id)) dayData.wins++;
                else if (Number(winner_id) !== 0) dayData.losses++;
            }
        } catch {
            
            return;
        }
    });

    const allZero = last7Days.every((d: { wins: number; losses: number }) => d.wins === 0 && d.losses === 0);
    if (allZero) {
        
    }

    return (
        <div className="flex-1/2 flex flex-col justify-between  border-[#7b5ddf3d] shadow-[0_0_10px_#7b5ddf22] backdrop-blur-sm rounded-lg p-6 border bg-[#2b24423d]">
            {}
            <div className="mb-6">
                <h3 className="flex items-center gap-2 text-xl font-bold text-white mb-2">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    Performance Chart
                </h3>
                <p className="text-gray-400 text-sm">Weekly wins vs losses</p>
            </div>

            {}
            <div className="flex-1 min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={last7Days} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="day" stroke="#9ca3af" fontSize={12} />
                        <YAxis stroke="#9ca3af" fontSize={12} />
                        <Tooltip content={(props) => <CustomTooltip {...props} />} />
                        <Line type="monotone" dataKey="wins" stroke="#0ea5e9" strokeWidth={6} dot />
                        <Line type="monotone" dataKey="losses" stroke="#8b5cf6" strokeWidth={6} dot />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {}
            <div className="flex items-center justify-center gap-6 mt-4">
                {[
                    { label: 'Wins', color: 'bg-blue-400' },
                    { label: 'Losses', color: 'bg-purple-400' }
                ].map(({ label, color }) => (
                    <div key={label} className="flex items-center gap-2">
                        <div className={`w-3 h-3 ${color} rounded-full`} />
                        <span className="text-gray-300 text-sm">{label}</span>
                    </div>
                ))}
            </div>


        </div>
    );
};

export default SimplePerformanceChart;
