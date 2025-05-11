import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, Baby, Briefcase, Calendar, Stethoscope, Tent } from "lucide-react"

interface LeaveCardProps {
  title: string
  count: number
  type: string
}

export function LeaveCard({ title, count, type }: LeaveCardProps) {
  const getIcon = () => {
    switch (type) {
      case "sick":
        return <Stethoscope className="h-6 w-6 text-white" />
      case "maternity":
        return <Baby className="h-6 w-6 text-white" />
      case "unpaid":
        return <Briefcase className="h-6 w-6 text-white" />
      case "annual":
        return <Calendar className="h-6 w-6 text-white" />
      case "important":
        return <AlertTriangle className="h-6 w-6 text-white" />
      case "extended":
        return <Tent className="h-6 w-6 text-white" />
      default:
        return <Calendar className="h-6 w-6 text-white" />
    }
  }

  const getColor = () => {
    switch (type) {
      case "sick":
        return "bg-[hsl(var(--sick-leave))]"
      case "maternity":
        return "bg-[hsl(var(--maternity-leave))]"
      case "unpaid":
        return "bg-[hsl(var(--unpaid-leave))]"
      case "annual":
        return "bg-[hsl(var(--annual-leave))]"
      case "important":
        return "bg-[hsl(var(--important-leave))]"
      case "extended":
        return "bg-[hsl(var(--extended-leave))]"
      default:
        return "bg-primary"
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className={`p-4 ${getColor()}`}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-lg">{title}</CardTitle>
          {getIcon()}
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="text-3xl font-bold">{count}</div>
      </CardContent>
    </Card>
  )
}

