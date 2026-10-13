import React from "react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatValue } from "@/components/market-ui";
import { Cell, Label, Pie, PieChart } from "recharts";

type CacheChartItem = {
  key: string;
  name: string;
  value: number;
  fill: string;
};

const cacheChartConfig = {
  fresh: { label: "صالحة حاليًا", color: "#34d399" },
  retained: { label: "ضمن نافذة الاحتفاظ", color: "#fbbf24" },
  cleanup: { label: "مؤهلة للتنظيف", color: "#fb7185" },
} satisfies ChartConfig;

export default function AdminCacheDistributionChart({
  data,
  total,
}: {
  data: CacheChartItem[];
  total: number;
}) {
  return (
    <ChartContainer
      id="admin-cache-distribution"
      config={cacheChartConfig}
      className="mx-auto aspect-square h-44 w-44"
    >
      <PieChart>
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideLabel nameKey="name" />}
        />
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={48}
          outerRadius={72}
          strokeWidth={3}
        >
          {data.map(item => (
            <Cell key={item.key} fill={item.fill} />
          ))}
          <Label
            position="center"
            content={({ viewBox }) =>
              viewBox && "cx" in viewBox && "cy" in viewBox ? (
                <text
                  x={viewBox.cx}
                  y={viewBox.cy}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  <tspan className="fill-foreground text-xl font-semibold">
                    {formatValue(total, 0)}
                  </tspan>
                  <tspan
                    x={viewBox.cx}
                    dy="1.45em"
                    className="fill-muted-foreground text-[10px]"
                  >
                    إجمالي اللقطات
                  </tspan>
                </text>
              ) : null
            }
          />
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}
