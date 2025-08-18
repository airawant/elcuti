"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Edit, Trash, Download, HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const userFormSchema = z.object({
  name: z.string().min(2, {
    message: "Name must be at least 2 characters",
  }),
  nip: z.string().min(1, {
    message: "NIP is required",
  }),
  role: z.enum(["admin", "user"]),
  position: z.string().min(1, {
    message: "Position is required",
  }),
  workunit: z.string().min(1, {
    message: "Work Unit is required",
  }),
  email: z.string().email({
    message: "Please enter a valid email address",
  }),
  phone: z.string().min(1, {
    message: "Phone number is required",
  }),
  address: z.string().min(1, {
    message: "Address is required",
  }),
  masa_kerja: z.string().optional(),
  tipe_pengguna: z.enum(["PNS", "PPPK"]).default("PNS"),
  isapprover: z.boolean().default(false),
  isauthorizedofficer: z.boolean().default(false),
  password: z
    .union([
      z.string().min(6, {
        message: "Password must be at least 6 characters",
      }),
      z.string().length(0), // Mengizinkan string kosong
    ])
    .optional(),
  leave_balance: z.record(z.string(), z.number()).optional(),
});

export default function AdminUsersPage() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const { user, users, leaveRequests, addUser, updateUser, deleteUser } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  // Get current year and previous year for leave balance
  const currentYear = new Date().getFullYear().toString();
  const previousYear = (new Date().getFullYear() - 1).toString();
  const twoYearsAgo = (new Date().getFullYear() - 2).toString();

  // Fungsi untuk menghitung saldo cuti yang tersisa dengan benar
  const calculateRemainingLeaveBalance = (userId: number, year: string) => {
    if (!users || !leaveRequests) return 0;

    // Dapatkan user
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser || !targetUser.leave_balance) return 0;

    // Sisa saldo sekarang langsung dari leave_balance
    return Math.max(0, targetUser.leave_balance[year] || 0);
  };

  const addForm = useForm<z.infer<typeof userFormSchema>>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: "",
      nip: "",
      role: "user",
      position: "",
      workunit: "",
      email: "",
      phone: "",
      address: "",
      masa_kerja: "",
      tipe_pengguna: "PNS",
      isapprover: false,
      isauthorizedofficer: false,
      password: "",
      leave_balance: {
        [twoYearsAgo]: 0,
        [previousYear]: 6,
        [currentYear]: 12,
      },
    },
  });

  const editForm = useForm<z.infer<typeof userFormSchema>>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: "",
      nip: "",
      role: "user",
      position: "",
      workunit: "",
      email: "",
      phone: "",
      address: "",
      masa_kerja: "",
      tipe_pengguna: "PNS",
      isapprover: false,
      isauthorizedofficer: false,
      password: "",
      leave_balance: {
        [twoYearsAgo]: 0,
        [previousYear]: 6,
        [currentYear]: 12,
      },
    },
  });

  // Redirect if not logged in or not admin
  useEffect(() => {
    if (!user) {
      router.push("/login");
    } else if (user.role !== "admin") {
      router.push("/dashboard");
    }
  }, [user, router]);

  // Set edit form values when a user is selected
  useEffect(() => {
    if (selectedUser) {
      const userToEdit = users.find((u) => u.id === selectedUser);
      if (userToEdit) {
        const defaultLeaveBalance = {
          [twoYearsAgo]: 0,
          [previousYear]: 6,
          [currentYear]: 12,
        };

        editForm.reset({
          name: userToEdit.name || "",
          nip: userToEdit.nip || "",
          role: userToEdit.role || "user",
          position: userToEdit.position || "",
          workunit: userToEdit.workunit || "",
          email: userToEdit.email || "",
          phone: userToEdit.phone || "",
          address: userToEdit.address || "",
          masa_kerja: (userToEdit as any).masa_kerja || "",
          tipe_pengguna: userToEdit.tipe_pengguna || "PNS",
          isapprover: userToEdit.isapprover || false,
          isauthorizedofficer: userToEdit.isauthorizedofficer || false,
          password: "", // Password is optional for edit
          leave_balance: userToEdit.leave_balance || defaultLeaveBalance,
        });
      }
    }
  }, [selectedUser, users, editForm, currentYear, previousYear, twoYearsAgo]);

  if (!user || user.role !== "admin") {
    return null;
  }

  const handleAddUser = (values: z.infer<typeof userFormSchema>) => {
    // Use snake_case for API request
    console.log("Original values for add user:", values);

    const apiValues = {
      ...values,
      workunit: values.workunit,
      isapprover: values.isapprover,
      isauthorizedofficer: values.isauthorizedofficer,
      masa_kerja: values.masa_kerja || undefined,
    };

    console.log("Transformed values for API:", apiValues);

    addUser(apiValues);
    toast({
      title: "Pengguna ditambahkan",
      description: "Pengguna baru berhasil ditambahkan",
    });
    setIsAddDialogOpen(false);
    addForm.reset();
  };

  const handleEditUser = (values: z.infer<typeof userFormSchema>) => {
    if (selectedUser) {
      // If password is empty, remove it from values to keep existing password
      const updateValues = { ...values };
      if (!updateValues.password || updateValues.password === "") {
        delete updateValues.password;
      }

      // Rename fields to match the API expectations
      console.log("Original values for update:", updateValues);

      // Use snake_case for API request
      const apiValues = {
        ...updateValues,
        workunit: updateValues.workunit,
        isapprover: updateValues.isapprover,
        isauthorizedofficer: updateValues.isauthorizedofficer,
        masa_kerja: updateValues.masa_kerja || undefined,
      };

      console.log("Transformed values for API:", apiValues);

      updateUser(selectedUser, apiValues);
      toast({
        title: "Pengguna diperbarui",
        description: "Data pengguna berhasil diperbarui",
      });
      setIsEditDialogOpen(false);
    }
  };

  const handleDeleteUser = () => {
    if (selectedUser) {
      deleteUser(selectedUser);
      toast({
        title: "User deleted",
        description: "The user has been deleted successfully",
      });
      setIsDeleteDialogOpen(false);
    }
  };

  const openEditDialog = (userId: number) => {
    setSelectedUser(userId);
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (userId: number) => {
    setSelectedUser(userId);
    setIsDeleteDialogOpen(true);
  };

  // Fungsi untuk mengunduh data pengguna dalam format CSV
  const downloadUsersCSV = () => {
    // Header CSV
    const headers = [
      "Nama",
      "NIP",
      "Peran",
      "Jabatan",
      "Unit Kerja",
      "Email",
      "Telepon",
      "Alamat",
      "Tipe Pengguna",
      `Sisa Saldo ${twoYearsAgo}`,
      `Sisa Saldo ${previousYear}`,
      `Sisa Saldo ${currentYear}`,
      "Penyetuju",
      "Pejabat Berwenang",
    ];

    // Format data pengguna untuk CSV
    const csvData = users.map((user) => {
      // Ambil sisa saldo langsung dari leave_balance
      const twoYearsAgoRemainingBalance = user.leave_balance
        ? user.leave_balance[twoYearsAgo] || 0
        : 0;
      const previousYearRemainingBalance = user.leave_balance
        ? user.leave_balance[previousYear] || 0
        : 0;
      const currentYearRemainingBalance = user.leave_balance
        ? user.leave_balance[currentYear] || 0
        : 0;

      return [
        user.name || "",
        user.nip || "",
        user.role === "admin" ? "Administrator" : "Pengguna",
        user.position || "",
        user.workunit || "",
        user.email || "",
        user.phone || "",
        user.address || "",
        user.tipe_pengguna || "PNS",
        twoYearsAgoRemainingBalance,
        previousYearRemainingBalance,
        currentYearRemainingBalance,
        user.isapprover ? "Ya" : "Tidak",
        user.isauthorizedofficer ? "Ya" : "Tidak",
      ];
    });

    // Gabungkan header dan data
    const csvContent = [
      headers.join(","),
      ...csvData.map((row) =>
        row
          .map((cell) =>
            // Jika sel berisi koma, apit dengan tanda kutip
            typeof cell === "string" && cell.includes(",")
              ? `"${cell.replace(/"/g, '""')}"`
              : cell
          )
          .join(",")
      ),
    ].join("\n");

    // Buat file CSV dan unduh
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    // Set properti link untuk unduhan
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `daftar_pengguna_${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";

    // Tambahkan ke dokumen, klik, dan hapus
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar isAdmin />
      </div>

      {/* Mobile sidebar */}
      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <SheetContent side="left" className="p-0">
          <Sidebar isAdmin />
        </SheetContent>
      </Sheet>

      <div className="flex-1">
        <Header title="Manajemen Pengguna" onMenuClick={() => setIsMobileOpen(true)} />

        <main className="p-4 md:p-6 space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Daftar Pengguna</h1>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>Tambah Pengguna</Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-6">
                <DialogHeader className="sticky top-0 bg-white z-10 pb-4 border-b">
                  <DialogTitle>Tambah Pengguna Baru</DialogTitle>
                  <DialogDescription>
                    Lengkapi formulir berikut untuk menambahkan pengguna baru.
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-6">
                  <Form {...addForm}>
                    <form onSubmit={addForm.handleSubmit(handleAddUser)} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={addForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nama</FormLabel>
                              <FormControl>
                                <Input placeholder="Masukkan nama pengguna" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={addForm.control}
                          name="nip"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>NIP</FormLabel>
                              <FormControl>
                                <Input placeholder="Masukkan NIP" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={addForm.control}
                          name="role"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Peran</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Pilih peran" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="user">Pengguna</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={addForm.control}
                          name="position"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Jabatan</FormLabel>
                              <FormControl>
                                <Input placeholder="Masukkan jabatan" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={addForm.control}
                          name="workunit"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Unit Kerja</FormLabel>
                              <FormControl>
                                <Input placeholder="Masukkan unit kerja" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={addForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input type="email" placeholder="Masukkan email" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={addForm.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Telepon</FormLabel>
                              <FormControl>
                                <Input placeholder="Masukkan nomor telepon" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={addForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password</FormLabel>
                              <FormControl>
                                <Input
                                  type="password"
                                  placeholder="Masukkan password"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={addForm.control}
                          name="masa_kerja"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Masa Kerja</FormLabel>
                              <FormControl>
                                <Input
                                  type="date"
                                  placeholder="Pilih tanggal mulai kerja"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={addForm.control}
                          name="tipe_pengguna"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tipe Pengguna</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Pilih tipe pengguna" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="PNS">PNS</SelectItem>
                                  <SelectItem value="PPPK">PPPK</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={addForm.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Alamat</FormLabel>
                            <FormControl>
                              <Input placeholder="Masukkan alamat" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={addForm.control}
                          name="isapprover"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>Penyetuju</FormLabel>
                                <p className="text-sm text-muted-foreground">
                                  Dapat menyetujui permintaan cuti
                                </p>
                              </div>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={addForm.control}
                          name="isauthorizedofficer"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>Pejabat Berwenang</FormLabel>
                                <p className="text-sm text-muted-foreground">
                                  Memiliki wewenang persetujuan akhir
                                </p>
                              </div>
                            </FormItem>
                          )}
                        />
                      </div>

                      {addForm.watch("role") === "user" && (
                        <div className="space-y-4">
                          <h3 className="text-sm font-medium">Saldo Cuti</h3>
                          <div className="grid grid-cols-3 gap-4">
                            <FormField
                              control={addForm.control}
                              name={`leave_balance.${twoYearsAgo}`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Tahun N-2 ({twoYearsAgo})</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min="0"
                                      value={field.value ?? 0}
                                      onChange={(e) =>
                                        field.onChange(Number.parseInt(e.target.value) || 0)
                                      }
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={addForm.control}
                              name={`leave_balance.${previousYear}`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Tahun N-1 ({previousYear})</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min="0"
                                      value={field.value ?? 0}
                                      onChange={(e) =>
                                        field.onChange(Number.parseInt(e.target.value) || 0)
                                      }
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={addForm.control}
                              name={`leave_balance.${currentYear}`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Tahun Berjalan ({currentYear})</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min="0"
                                      value={field.value ?? 0}
                                      onChange={(e) =>
                                        field.onChange(Number.parseInt(e.target.value) || 0)
                                      }
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      )}
                      <DialogFooter>
                        <Button type="submit">Tambah Pengguna</Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader className="flex flex-row justify-between items-center">
              <CardTitle>User List</CardTitle>
              <Button
                variant="outline"
                onClick={downloadUsersCSV}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                <span>Unduh CSV</span>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <div className="flex flex-col items-start">
                          <span>Nama</span>
                          <span className="text-sm text-muted-foreground">NIP</span>
                        </div>
                      </TableHead>
                      <TableHead>Peran</TableHead>
                      <TableHead>Jabatan</TableHead>
                      <TableHead>Satuan Kerja</TableHead>
                      {/* <TableHead>Tipe Pengguna</TableHead> */}
                      <TableHead className="relative">
                        <div className="flex items-center gap-1">
                          <span>Sisa Cuti {twoYearsAgo}</span>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <HelpCircle className="h-4 w-4 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">
                                  Sisa saldo cuti setelah dikurangi cuti yang sudah diambil
                                  pada tahun {twoYearsAgo}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableHead>
                      <TableHead className="relative">
                        <div className="flex items-center gap-1">
                          <span>Sisa Cuti {previousYear}</span>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <HelpCircle className="h-4 w-4 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">
                                  Sisa saldo cuti setelah dikurangi cuti yang sudah diambil
                                  pada tahun {previousYear}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableHead>
                      <TableHead className="relative">
                        <div className="flex items-center gap-1">
                          <span>Sisa Cuti {currentYear}</span>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <HelpCircle className="h-4 w-4 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">
                                  Sisa saldo cuti setelah dikurangi cuti yang sudah diambil
                                  pada tahun {currentYear}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableHead>
                      <TableHead>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => {
                      // Ambil sisa saldo cuti langsung dari leave_balance
                      const twoYearsAgoRemainingBalance = user.leave_balance
                        ? user.leave_balance[twoYearsAgo] || 0
                        : 0;
                      const previousYearRemainingBalance = user.leave_balance
                        ? user.leave_balance[previousYear] || 0
                        : 0;
                      const currentYearRemainingBalance = user.leave_balance
                        ? user.leave_balance[currentYear] || 0
                        : 0;

                      return (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{user.name}</span>
                              <span className="text-sm text-muted-foreground">{user.nip}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {user.role === "admin" ? "Administrator" : "Pengguna"}
                          </TableCell>
                          <TableCell>{user.position}</TableCell>
                          <TableCell>{user.workunit}</TableCell>
                          {/* <TableCell>{user.tipe_pengguna}</TableCell> */}
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center">
                              <span className="font-medium">
                                {twoYearsAgoRemainingBalance} hari
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center">
                              <span className="font-medium">
                                {previousYearRemainingBalance} hari
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center">
                              <span className="font-medium">
                                {currentYearRemainingBalance} hari
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => openEditDialog(user.id)}
                                title="Edit Pengguna"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="text-red-500"
                                onClick={() => openDeleteDialog(user.id)}
                                title="Hapus Pengguna"
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader className="sticky top-0 bg-white z-10 pb-4 border-b">
            <DialogTitle>Edit Pengguna</DialogTitle>
            <DialogDescription>Perbarui informasi pengguna.</DialogDescription>
          </DialogHeader>
          <div className="mt-6">
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(handleEditUser)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nama</FormLabel>
                        <FormControl>
                          <Input placeholder="Masukkan nama pengguna" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="nip"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>NIP</FormLabel>
                        <FormControl>
                          <Input placeholder="Masukkan NIP" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Peran</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih peran" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="user">Pengguna</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="position"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Jabatan</FormLabel>
                        <FormControl>
                          <Input placeholder="Masukkan jabatan" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="workunit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit Kerja</FormLabel>
                        <FormControl>
                          <Input placeholder="Masukkan unit kerja" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="Masukkan email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telepon</FormLabel>
                        <FormControl>
                          <Input placeholder="Masukkan nomor telepon" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password (kosongkan untuk tidak mengubah)</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Masukkan password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="masa_kerja"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Masa Kerja</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            placeholder="Pilih tanggal mulai kerja"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="tipe_pengguna"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipe Pengguna</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih tipe pengguna" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="PNS">PNS</SelectItem>
                            <SelectItem value="PPPK">PPPK</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={editForm.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Alamat</FormLabel>
                      <FormControl>
                        <Input placeholder="Masukkan alamat" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="isapprover"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Penyetuju</FormLabel>
                          <p className="text-sm text-muted-foreground">
                            Dapat menyetujui permintaan cuti
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="isauthorizedofficer"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Pejabat Berwenang</FormLabel>
                          <p className="text-sm text-muted-foreground">
                            Memiliki wewenang persetujuan akhir
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                {editForm.watch("role") === "user" && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">Saldo Cuti</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={editForm.control}
                        name={`leave_balance.${twoYearsAgo}`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tahun N-2 ({twoYearsAgo})</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                value={field.value ?? 0}
                                onChange={(e) =>
                                  field.onChange(Number.parseInt(e.target.value) || 0)
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name={`leave_balance.${previousYear}`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tahun N-1 ({previousYear})</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                value={field.value ?? 0}
                                onChange={(e) =>
                                  field.onChange(Number.parseInt(e.target.value) || 0)
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name={`leave_balance.${currentYear}`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tahun Berjalan ({currentYear})</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                value={field.value ?? 0}
                                onChange={(e) =>
                                  field.onChange(Number.parseInt(e.target.value) || 0)
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button type="submit">Perbarui Pengguna</Button>
                </DialogFooter>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Pengguna</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus pengguna ini? Tindakan ini tidak dapat
              dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser}>
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
