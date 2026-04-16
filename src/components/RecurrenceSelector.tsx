import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toggle } from "@/components/ui/toggle";

const DAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];

type RecurrenceUnit = "day" | "week" | "month" | "custom_days";

function parseRule(rule: string | null): { interval: string; unit: RecurrenceUnit } {
  if (!rule) return { interval: "1", unit: "week" };
  const parts = rule.split(":");
  return { interval: parts[1] || "1", unit: (parts[2] as RecurrenceUnit) || "week" };
}

interface RecurrenceSelectorProps {
  value: string | null;
  onChange: (rule: string | null) => void;
  recurrenceDays: number[] | null;
  onRecurrenceDaysChange: (days: number[] | null) => void;
}

export function RecurrenceSelector({
  value,
  onChange,
  recurrenceDays,
  onRecurrenceDaysChange,
}: RecurrenceSelectorProps) {
  const enabled = !!value;
  const { interval, unit } = parseRule(value);

  const emit = (i: string, u: string, e: boolean) => {
    if (!e) {
      onChange(null);
      onRecurrenceDaysChange(null);
      return;
    }
    if (u === "custom_days") {
      onChange("every:1:custom_days");
      return;
    }
    const num = parseInt(i, 10);
    if (isNaN(num) || num <= 0) return;
    onChange(`every:${num}:${u}`);
    onRecurrenceDaysChange(null);
  };

  const toggleDay = (day: number) => {
    const current = recurrenceDays || [];
    const next = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day].sort();
    onRecurrenceDaysChange(next.length > 0 ? next : null);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Checkbox
          id="recurrence-enabled"
          checked={enabled}
          onCheckedChange={(checked) => {
            if (!checked) {
              onChange(null);
              onRecurrenceDaysChange(null);
            } else {
              emit(interval, unit, true);
            }
          }}
        />
        <Label htmlFor="recurrence-enabled" className="text-sm cursor-pointer">Recorrente</Label>
      </div>

      {enabled && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">A cada</span>
            {unit !== "custom_days" && (
              <Input
                type="number"
                min={1}
                value={interval}
                onChange={(e) => emit(e.target.value, unit, true)}
                className="w-16"
              />
            )}
            <Select
              value={unit}
              onValueChange={(v) => emit(interval, v, true)}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">dia(s)</SelectItem>
                <SelectItem value="week">semana(s)</SelectItem>
                <SelectItem value="month">mês(es)</SelectItem>
                <SelectItem value="custom_days">Dias Específicos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {unit === "custom_days" && (
            <div className="flex gap-1">
              {DAY_LABELS.map((label, idx) => (
                <Toggle
                  key={idx}
                  pressed={recurrenceDays?.includes(idx) ?? false}
                  onPressedChange={() => toggleDay(idx)}
                  className="h-9 w-9 rounded-full text-xs font-medium p-0"
                  aria-label={label}
                >
                  {label}
                </Toggle>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
