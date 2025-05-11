import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface EmployeeDataProps {
  data: {
    name: string
    nip: string
    position: string
    workUnit: string
    yearsOfService: string
  }
}

export function EmployeeData({ data }: EmployeeDataProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>I. DATA PEGAWAI</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium">Nama</p>
          <p>{data.name}</p>
        </div>
        <div>
          <p className="text-sm font-medium">NIP</p>
          <p>{data.nip}</p>
        </div>
        <div>
          <p className="text-sm font-medium">Jabatan</p>
          <p>{data.position}</p>
        </div>
        <div>
          <p className="text-sm font-medium">Masa Kerja</p>
          <p>{data.yearsOfService}</p>
        </div>
        <div className="col-span-2">
          <p className="text-sm font-medium">Unit Kerja</p>
          <p>{data.workUnit}</p>
        </div>
      </CardContent>
    </Card>
  )
}

