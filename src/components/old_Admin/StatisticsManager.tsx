import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { BarChart, PieChart, DollarSign, Users, ArrowUpDown } from 'lucide-react';

interface UserStat {
  user_id: string;
  user_email: string;
  user_name: string;
  total_amount: number;
  currency: string;
  transfer_count: number;
}

interface DirectionStat {
  direction: string;
  total_amount: number;
  currency: string;
  transfer_count: number;
}

const StatisticsManager = () => {
  const [userStats, setUserStats] = useState<UserStat[]>([]);
  const [directionStats, setDirectionStats] = useState<DirectionStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalAmount, setTotalAmount] = useState<{[key: string]: number}>({});
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch statistics by user
      const { data: userStatsData, error: userStatsError } = await supabase
        .rpc('get_user_transfer_stats');

      if (userStatsError) throw userStatsError;

      // Fetch statistics by direction
      const { data: directionStatsData, error: directionStatsError } = await supabase
        .rpc('get_direction_transfer_stats');

      if (directionStatsError) throw directionStatsError;

      // If RPC functions don't exist, fall back to direct queries
      if (!userStatsData || !directionStatsData) {
        await fetchStatisticsDirectly();
        return;
      }

      setUserStats(userStatsData);
      setDirectionStats(directionStatsData);

      // Calculate totals
      const totals: {[key: string]: number} = {};
      let count = 0;
      
      directionStatsData.forEach((stat: DirectionStat) => {
        if (!totals[stat.currency]) {
          totals[stat.currency] = 0;
        }
        totals[stat.currency] += Number(stat.total_amount);
        count += stat.transfer_count;
      });

      setTotalAmount(totals);
      setTotalCount(count);

    } catch (err) {
      console.error('Error fetching statistics:', err);
      setError('Une erreur est survenue lors du chargement des statistiques');
      
      // Try direct query as fallback
      await fetchStatisticsDirectly();
    } finally {
      setLoading(false);
    }
  };

  const fetchStatisticsDirectly = async () => {
    try {
      // Fetch statistics by user
      const { data: userStatsData, error: userStatsError } = await supabase
        .from('transfers')
        .select(`
          amount_sent,
          sender_currency,
          user_id,
          users!transfers_user_id_fkey (
            email,
            first_name,
            last_name
          )
        `)
        .eq('status', 'completed');

      if (userStatsError) throw userStatsError;

      // Fetch statistics by direction
      const { data: directionStatsData, error: directionStatsError } = await supabase
        .from('transfers')
        .select(`
          amount_sent,
          sender_currency,
          direction
        `)
        .eq('status', 'completed');

      if (directionStatsError) throw directionStatsError;

      // Process user stats
      const userStatsMap = new Map<string, UserStat>();
      
      userStatsData?.forEach(transfer => {
        const userId = transfer.user_id;
        const amount = Number(transfer.amount_sent);
        const currency = transfer.sender_currency;
        const email = transfer.users?.email || 'Unknown';
        const firstName = transfer.users?.first_name || '';
        const lastName = transfer.users?.last_name || '';
        
        if (!userStatsMap.has(userId)) {
          userStatsMap.set(userId, {
            user_id: userId,
            user_email: email,
            user_name: `${firstName} ${lastName}`,
            total_amount: 0,
            currency: currency,
            transfer_count: 0
          });
        }
        
        const stat = userStatsMap.get(userId)!;
        stat.total_amount += amount;
        stat.transfer_count += 1;
      });
      
      // Process direction stats
      const directionStatsMap = new Map<string, DirectionStat>();
      
      directionStatsData?.forEach(transfer => {
        const direction = transfer.direction || 'Unknown';
        const amount = Number(transfer.amount_sent);
        const currency = transfer.sender_currency;
        
        if (!directionStatsMap.has(direction)) {
          directionStatsMap.set(direction, {
            direction: direction,
            total_amount: 0,
            currency: currency,
            transfer_count: 0
          });
        }
        
        const stat = directionStatsMap.get(direction)!;
        stat.total_amount += amount;
        stat.transfer_count += 1;
      });

      setUserStats(Array.from(userStatsMap.values()));
      setDirectionStats(Array.from(directionStatsMap.values()));

      // Calculate totals
      const totals: {[key: string]: number} = {};
      let count = 0;
      
      directionStatsMap.forEach((stat) => {
        if (!totals[stat.currency]) {
          totals[stat.currency] = 0;
        }
        totals[stat.currency] += stat.total_amount;
        count += stat.transfer_count;
      });

      setTotalAmount(totals);
      setTotalCount(count);

    } catch (err) {
      console.error('Error in direct statistics query:', err);
      setError('Une erreur est survenue lors du chargement des statistiques');
    }
  };

  const getDirectionLabel = (direction: string) => {
    const directions: Record<string, string> = {
      'FRANCE_TO_GABON': 'France → Gabon',
      'GABON_TO_FRANCE': 'Gabon → France',
      'GABON_TO_CHINA': 'Gabon → Chine',
      'USA_TO_GABON': 'États-Unis → Gabon',
      'GABON_TO_USA': 'Gabon → États-Unis',
      'CANADA_TO_GABON': 'Canada → Gabon',
      'GABON_TO_CANADA': 'Gabon → Canada',
      'BELGIUM_TO_GABON': 'Belgique → Gabon',
      'GABON_TO_BELGIUM': 'Gabon → Belgique',
      'GERMANY_TO_GABON': 'Allemagne → Gabon',
      'GABON_TO_GERMANY': 'Gabon → Allemagne'
    };
    return directions[direction] || direction;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Statistiques des transferts validés</h2>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Total des transferts</h3>
            <DollarSign className="h-8 w-8 text-yellow-500" />
          </div>
          <div className="mt-4">
            {Object.entries(totalAmount).map(([currency, amount]) => (
              <p key={currency} className="text-3xl font-bold text-yellow-600">
                {amount.toLocaleString('fr-FR')} {currency}
              </p>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Nombre de transferts</h3>
            <ArrowUpDown className="h-8 w-8 text-yellow-500" />
          </div>
          <p className="mt-4 text-3xl font-bold text-yellow-600">{totalCount}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Utilisateurs actifs</h3>
            <Users className="h-8 w-8 text-yellow-500" />
          </div>
          <p className="mt-4 text-3xl font-bold text-yellow-600">{userStats.length}</p>
        </div>
      </div>

      {/* Statistics by Direction */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center">
            <BarChart className="h-5 w-5 text-yellow-500 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Statistiques par direction</h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Direction
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Montant total
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nombre de transferts
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Montant moyen
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {directionStats.map((stat, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {getDirectionLabel(stat.direction)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {Number(stat.total_amount).toLocaleString('fr-FR')} {stat.currency}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {stat.transfer_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {(Number(stat.total_amount) / stat.transfer_count).toLocaleString('fr-FR')} {stat.currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Statistics by User */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center">
            <PieChart className="h-5 w-5 text-yellow-500 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Statistiques par utilisateur</h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Utilisateur
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Montant total
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nombre de transferts
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Montant moyen
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {userStats.map((stat, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {stat.user_name || 'Utilisateur inconnu'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {stat.user_email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {Number(stat.total_amount).toLocaleString('fr-FR')} {stat.currency}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {stat.transfer_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {(Number(stat.total_amount) / stat.transfer_count).toLocaleString('fr-FR')} {stat.currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StatisticsManager;