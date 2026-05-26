import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useFetch } from "@/hooks/useFetch";
import { useSSERefresh } from "@/hooks/useSSERefresh";
import { ROOM_NAMES } from "@/lib/constants";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const chartConfig = {
  broadcasts: { label: "Broadcasts", color: "var(--chart-1)" },
  count: { label: "Count", color: "var(--chart-2)" },
  answered: { label: "Answered", color: "var(--chart-3)" },
  unanswered: { label: "Unanswered", color: "var(--chart-5)" },
};

export default function BroadcastsPage() {
  const { data, loading, refetch } = useFetch("/api/v1/admin/broadcasts");
  useSSERefresh(refetch, ["broadcasts"]);

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-[300px]" />
          <Skeleton className="h-[300px]" />
        </div>
        <Skeleton className="h-[200px]" />
      </div>
    );
  }

  const hourly = data?.hourly || [];
  const daily = data?.daily || [];
  const topBroadcasters = data?.topBroadcasters || [];
  const todayAnswered = data?.todayAnswered || 0;
  const todayUnanswered = data?.todayUnanswered || 0;

  const pieData = [
    { name: "Answered", value: todayAnswered || 0, fill: "var(--chart-3)" },
    { name: "Unanswered", value: todayUnanswered || 0, fill: "var(--chart-5)" },
  ];

  const totalToday = todayAnswered + todayUnanswered;
  const answerRate = totalToday > 0 ? ((todayAnswered / totalToday) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Broadcasts</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Analytics and performance metrics for broadcast activity
        </p>
      </div>

      <Tabs defaultValue="today" className="space-y-6">
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="week">7 Days</TabsTrigger>
          <TabsTrigger value="month">30 Days</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Hourly Activity</CardTitle>
                <CardDescription>Distribution of today's broadcasts by hour</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[250px] w-full">
                  <BarChart data={hourly}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis dataKey="hour" className="text-xs" tickLine={false} axisLine={false} />
                    <YAxis className="text-xs" tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="broadcasts" fill="var(--color-broadcasts)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
                <CardDescription>
                  <span className="font-mono tabular-nums">{answerRate}%</span> of broadcasts answered today
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center">
                <ChartContainer config={chartConfig} className="h-[250px] w-full">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <text
                      x="50%"
                      y="50%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-foreground text-2xl font-bold"
                    >
                      {totalToday}
                    </text>
                  </PieChart>
                </ChartContainer>
              </CardContent>
              <div className="flex justify-center gap-6 pb-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block size-2 rounded-full bg-green-500" />
                  Answered ({todayAnswered})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block size-2 rounded-full bg-red-500" />
                  Unanswered ({todayUnanswered})
                </span>
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Top Broadcasters</CardTitle>
              <CardDescription>Most active users today</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">#</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topBroadcasters.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No broadcast data available
                      </TableCell>
                    </TableRow>
                  ) : (
                    topBroadcasters.slice(0, 10).map((b, i) => (
                      <TableRow key={b.userName || b.user_name || i}>
                        <TableCell className="font-mono text-sm tabular-nums text-muted-foreground">
                          #{i + 1}
                        </TableCell>
                        <TableCell className="font-medium">
                          {b.userName || b.user_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {ROOM_NAMES[b.room] || b.room || "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums font-medium">
                          {b.count}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="week" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Daily Trend</CardTitle>
              <CardDescription>Broadcast volume over the past 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <LineChart data={daily.slice(-7)}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="date" className="text-xs" tickLine={false} axisLine={false} />
                  <YAxis className="text-xs" tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="var(--color-count)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "var(--color-count)" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="month" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Daily Trend</CardTitle>
              <CardDescription>Broadcast volume over the past 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <LineChart data={daily.slice(-30)}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="date" className="text-xs" tickLine={false} axisLine={false} />
                  <YAxis className="text-xs" tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="var(--color-count)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
