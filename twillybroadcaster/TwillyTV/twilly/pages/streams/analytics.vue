<template>
  <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black py-12 px-4">
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold text-white mb-3">
          Stream <span class="text-teal-400">Analytics</span>
        </h1>
        <p class="text-gray-300 text-lg">
          Track your stream performance and audience engagement
        </p>
      </div>

      <!-- Date Range Selector -->
      <div class="bg-black/30 backdrop-blur-sm rounded-xl border border-teal-900/30 p-6 mb-8">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <label class="text-gray-300">Date Range:</label>
            <select 
              v-model="selectedDateRange"
              @change="updateDateRange"
              class="bg-black/20 border border-teal-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last year</option>
              <option value="custom">Custom range</option>
            </select>
          </div>
          <div class="flex items-center gap-3">
            <button 
              @click="exportData"
              class="px-4 py-2 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-lg hover:bg-teal-500/30 transition-all duration-300"
            >
              <Icon name="heroicons:arrow-down-tray" class="w-4 h-4 inline mr-2" />
              Export Data
            </button>
            <button 
              @click="refreshData"
              class="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
            >
              <Icon name="heroicons:arrow-path" class="w-4 h-4 inline mr-2" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <!-- Key Metrics -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div class="bg-black/30 backdrop-blur-sm rounded-xl border border-teal-900/30 p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-gray-300 text-sm font-medium">Total Views</h3>
            <Icon name="heroicons:eye" class="w-5 h-5 text-teal-400" />
          </div>
          <div class="text-2xl font-bold text-white mb-2">{{ formatNumber(metrics.totalViews) }}</div>
          <div class="flex items-center text-sm">
            <Icon name="heroicons:arrow-trending-up" class="w-4 h-4 text-green-400 mr-1" />
            <span class="text-green-400">+{{ metrics.viewsGrowth }}%</span>
            <span class="text-gray-400 ml-1">vs last period</span>
          </div>
        </div>

        <div class="bg-black/30 backdrop-blur-sm rounded-xl border border-teal-900/30 p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-gray-300 text-sm font-medium">Total Revenue</h3>
            <Icon name="heroicons:currency-dollar" class="w-5 h-5 text-teal-400" />
          </div>
          <div class="text-2xl font-bold text-white mb-2">${{ formatNumber(metrics.totalRevenue) }}</div>
          <div class="flex items-center text-sm">
            <Icon name="heroicons:arrow-trending-up" class="w-4 h-4 text-green-400 mr-1" />
            <span class="text-green-400">+{{ metrics.revenueGrowth }}%</span>
            <span class="text-gray-400 ml-1">vs last period</span>
          </div>
        </div>

        <div class="bg-black/30 backdrop-blur-sm rounded-xl border border-teal-900/30 p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-gray-300 text-sm font-medium">Average Watch Time</h3>
            <Icon name="heroicons:clock" class="w-5 h-5 text-teal-400" />
          </div>
          <div class="text-2xl font-bold text-white mb-2">{{ formatDuration(metrics.avgWatchTime) }}</div>
          <div class="flex items-center text-sm">
            <Icon name="heroicons:arrow-trending-up" class="w-4 h-4 text-green-400 mr-1" />
            <span class="text-green-400">+{{ metrics.watchTimeGrowth }}%</span>
            <span class="text-gray-400 ml-1">vs last period</span>
          </div>
        </div>

        <div class="bg-black/30 backdrop-blur-sm rounded-xl border border-teal-900/30 p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-gray-300 text-sm font-medium">Engagement Rate</h3>
            <Icon name="heroicons:heart" class="w-5 h-5 text-teal-400" />
          </div>
          <div class="text-2xl font-bold text-white mb-2">{{ metrics.engagementRate }}%</div>
          <div class="flex items-center text-sm">
            <Icon name="heroicons:arrow-trending-down" class="w-4 h-4 text-red-400 mr-1" />
            <span class="text-red-400">-{{ metrics.engagementGrowth }}%</span>
            <span class="text-gray-400 ml-1">vs last period</span>
          </div>
        </div>
      </div>

      <!-- Charts Section -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <!-- Views Over Time -->
        <div class="bg-black/30 backdrop-blur-sm rounded-xl border border-teal-900/30 p-6">
          <h3 class="text-xl font-semibold text-white mb-4">Views Over Time</h3>
          <div class="h-64 bg-black/20 rounded-lg p-4">
            <!-- Chart placeholder -->
            <div class="flex items-end justify-between h-full">
              <div v-for="(day, index) in viewsData" :key="index" class="flex flex-col items-center">
                <div 
                  class="bg-teal-500 rounded-t w-8 mb-2 transition-all duration-300 hover:bg-teal-400"
                  :style="{ height: (day.views / maxViews) * 200 + 'px' }"
                ></div>
                <span class="text-xs text-gray-400">{{ day.date }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Revenue Chart -->
        <div class="bg-black/30 backdrop-blur-sm rounded-xl border border-teal-900/30 p-6">
          <h3 class="text-xl font-semibold text-white mb-4">Revenue Trends</h3>
          <div class="h-64 bg-black/20 rounded-lg p-4">
            <!-- Chart placeholder -->
            <div class="flex items-end justify-between h-full">
              <div v-for="(day, index) in revenueData" :key="index" class="flex flex-col items-center">
                <div 
                  class="bg-green-500 rounded-t w-8 mb-2 transition-all duration-300 hover:bg-green-400"
                  :style="{ height: (day.revenue / maxRevenue) * 200 + 'px' }"
                ></div>
                <span class="text-xs text-gray-400">{{ day.date }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Stream Performance Table -->
      <div class="bg-black/30 backdrop-blur-sm rounded-xl border border-teal-900/30 p-6 mb-8">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-xl font-semibold text-white">Stream Performance</h3>
          <div class="flex items-center gap-3">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search streams..."
              class="bg-black/20 border border-teal-500/30 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-teal-500"
            />
            <select 
              v-model="sortBy"
              class="bg-black/20 border border-teal-500/30 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-teal-500"
            >
              <option value="views">Sort by Views</option>
              <option value="revenue">Sort by Revenue</option>
              <option value="date">Sort by Date</option>
            </select>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-gray-700">
                <th class="text-left py-3 px-4 text-gray-300 font-medium">Stream</th>
                <th class="text-left py-3 px-4 text-gray-300 font-medium">Date</th>
                <th class="text-left py-3 px-4 text-gray-300 font-medium">Views</th>
                <th class="text-left py-3 px-4 text-gray-300 font-medium">Revenue</th>
                <th class="text-left py-3 px-4 text-gray-300 font-medium">Watch Time</th>
                <th class="text-left py-3 px-4 text-gray-300 font-medium">Engagement</th>
                <th class="text-left py-3 px-4 text-gray-300 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="stream in filteredStreams" :key="stream.id" class="border-b border-gray-800 hover:bg-gray-800/30">
                <td class="py-3 px-4">
                  <div class="flex items-center gap-3">
                    <div class="w-12 h-8 bg-teal-500/20 rounded overflow-hidden">
                      <img :src="stream.thumbnail" :alt="stream.title" class="w-full h-full object-cover" />
                    </div>
                    <div>
                      <div class="text-white font-medium">{{ stream.title }}</div>
                      <div class="text-gray-400 text-sm">{{ stream.category }}</div>
                    </div>
                  </div>
                </td>
                <td class="py-3 px-4 text-gray-300">{{ formatDate(stream.date) }}</td>
                <td class="py-3 px-4 text-white">{{ formatNumber(stream.views) }}</td>
                <td class="py-3 px-4 text-white">${{ formatNumber(stream.revenue) }}</td>
                <td class="py-3 px-4 text-gray-300">{{ formatDuration(stream.watchTime) }}</td>
                <td class="py-3 px-4">
                  <div class="flex items-center gap-2">
                    <div class="w-16 bg-gray-700 rounded-full h-2">
                      <div 
                        class="bg-teal-500 h-2 rounded-full"
                        :style="{ width: stream.engagement + '%' }"
                      ></div>
                    </div>
                    <span class="text-gray-300 text-sm">{{ stream.engagement }}%</span>
                  </div>
                </td>
                <td class="py-3 px-4">
                  <button 
                    @click="viewDetails(stream.id)"
                    class="text-teal-400 hover:text-teal-300 transition-colors"
                  >
                    <Icon name="heroicons:eye" class="w-4 h-4" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Audience Demographics -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <!-- Geographic Distribution -->
        <div class="bg-black/30 backdrop-blur-sm rounded-xl border border-teal-900/30 p-6">
          <h3 class="text-xl font-semibold text-white mb-4">Geographic Distribution</h3>
          <div class="space-y-3">
            <div v-for="region in geographicData" :key="region.country" class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 bg-teal-500/20 rounded-full flex items-center justify-center">
                  <span class="text-teal-400 text-sm font-medium">{{ region.country.charAt(0) }}</span>
                </div>
                <span class="text-white">{{ region.country }}</span>
              </div>
              <div class="flex items-center gap-3">
                <div class="w-24 bg-gray-700 rounded-full h-2">
                  <div 
                    class="bg-teal-500 h-2 rounded-full"
                    :style="{ width: region.percentage + '%' }"
                  ></div>
                </div>
                <span class="text-gray-300 text-sm w-12 text-right">{{ region.percentage }}%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Device Types -->
        <div class="bg-black/30 backdrop-blur-sm rounded-xl border border-teal-900/30 p-6">
          <h3 class="text-xl font-semibold text-white mb-4">Device Types</h3>
          <div class="space-y-3">
            <div v-for="device in deviceData" :key="device.type" class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <Icon :name="device.icon" class="w-5 h-5 text-teal-400" />
                <span class="text-white">{{ device.type }}</span>
              </div>
              <div class="flex items-center gap-3">
                <div class="w-24 bg-gray-700 rounded-full h-2">
                  <div 
                    class="bg-teal-500 h-2 rounded-full"
                    :style="{ width: device.percentage + '%' }"
                  ></div>
                </div>
                <span class="text-gray-300 text-sm w-12 text-right">{{ device.percentage }}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Engagement Metrics -->
      <div class="bg-black/30 backdrop-blur-sm rounded-xl border border-teal-900/30 p-6">
        <h3 class="text-xl font-semibold text-white mb-4">Engagement Metrics</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="text-center">
            <div class="text-3xl font-bold text-teal-400 mb-2">{{ engagementMetrics.likes }}</div>
            <div class="text-gray-300">Total Likes</div>
          </div>
          <div class="text-center">
            <div class="text-3xl font-bold text-teal-400 mb-2">{{ engagementMetrics.comments }}</div>
            <div class="text-gray-300">Total Comments</div>
          </div>
          <div class="text-center">
            <div class="text-3xl font-bold text-teal-400 mb-2">{{ engagementMetrics.shares }}</div>
            <div class="text-gray-300">Total Shares</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';

// State
const selectedDateRange = ref('30');
const searchQuery = ref('');
const sortBy = ref('views');

// Mock data
const metrics = ref({
  totalViews: 124750,
  viewsGrowth: 15.3,
  totalRevenue: 2847.50,
  revenueGrowth: 22.1,
  avgWatchTime: 1800, // 30 minutes in seconds
  watchTimeGrowth: 8.7,
  engagementRate: 12.4,
  engagementGrowth: 2.1
});

const viewsData = ref([
  { date: 'Mon', views: 1200 },
  { date: 'Tue', views: 1800 },
  { date: 'Wed', views: 2100 },
  { date: 'Thu', views: 1600 },
  { date: 'Fri', views: 2400 },
  { date: 'Sat', views: 2800 },
  { date: 'Sun', views: 2200 }
]);

const revenueData = ref([
  { date: 'Mon', revenue: 45 },
  { date: 'Tue', revenue: 67 },
  { date: 'Wed', revenue: 89 },
  { date: 'Thu', revenue: 56 },
  { date: 'Fri', revenue: 120 },
  { date: 'Sat', revenue: 145 },
  { date: 'Sun', revenue: 98 }
]);

const streams = ref([
  {
    id: 'stream1',
    title: 'Dark Knights Opening Ceremony',
    category: 'Entertainment',
    thumbnail: 'https://via.placeholder.com/400x225/14b8a6/ffffff?text=Opening',
    date: new Date('2024-01-15'),
    views: 1247,
    revenue: 89.50,
    watchTime: 1800,
    engagement: 85
  },
  {
    id: 'stream2',
    title: 'Main Event Highlights',
    category: 'Entertainment',
    thumbnail: 'https://via.placeholder.com/400x225/14b8a6/ffffff?text=Main+Event',
    date: new Date('2024-01-14'),
    views: 892,
    revenue: 67.25,
    watchTime: 2400,
    engagement: 78
  },
  {
    id: 'stream3',
    title: 'Behind the Scenes',
    category: 'Entertainment',
    thumbnail: 'https://via.placeholder.com/400x225/14b8a6/ffffff?text=Behind+Scenes',
    date: new Date('2024-01-13'),
    views: 567,
    revenue: 34.75,
    watchTime: 900,
    engagement: 92
  }
]);

const geographicData = ref([
  { country: 'United States', percentage: 45 },
  { country: 'United Kingdom', percentage: 18 },
  { country: 'Canada', percentage: 12 },
  { country: 'Australia', percentage: 8 },
  { country: 'Germany', percentage: 7 },
  { country: 'Other', percentage: 10 }
]);

const deviceData = ref([
  { type: 'Mobile', percentage: 52, icon: 'heroicons:device-phone-mobile' },
  { type: 'Desktop', percentage: 38, icon: 'heroicons:computer-desktop' },
  { type: 'Tablet', percentage: 10, icon: 'heroicons:device-tablet' }
]);

const engagementMetrics = ref({
  likes: 2847,
  comments: 1247,
  shares: 567
});

// Computed properties
const maxViews = computed(() => Math.max(...viewsData.value.map(d => d.views)));
const maxRevenue = computed(() => Math.max(...revenueData.value.map(d => d.revenue)));

const filteredStreams = computed(() => {
  let filtered = streams.value;

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(stream => 
      stream.title.toLowerCase().includes(query) ||
      stream.category.toLowerCase().includes(query)
    );
  }

  switch (sortBy.value) {
    case 'views':
      filtered.sort((a, b) => b.views - a.views);
      break;
    case 'revenue':
      filtered.sort((a, b) => b.revenue - a.revenue);
      break;
    case 'date':
      filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
      break;
  }

  return filtered;
});

// Methods
const updateDateRange = () => {
  console.log('Updating date range to:', selectedDateRange.value);
  // Implement date range update logic
};

const exportData = () => {
  // Implement export functionality
  alert('Exporting analytics data...');
};

const refreshData = () => {
  // Implement refresh functionality
  console.log('Refreshing analytics data...');
};

const viewDetails = (streamId) => {
  navigateTo(`/streams/play/${streamId}`);
};

// Utility functions
const formatNumber = (num) => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};

const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

const formatDate = (date) => {
  return new Date(date).toLocaleDateString();
};

onMounted(() => {
  // Initialize analytics data
  console.log('Analytics dashboard loaded');
});
</script>

<style scoped>
.backdrop-blur-sm {
  backdrop-filter: blur(8px);
}
</style> 