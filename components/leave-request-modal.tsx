"use client";

import type React from "react";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Check, Calendar, Lock, Search, X, ExternalLink } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { SearchDialog } from "@/components/leave-request/search-dialog";
import { LeaveCalculation } from "@/components/leave-request/leave-calculation";
import { LeaveBalanceInfo } from "@/components/leave-request/leave-balance-info";
import { Badge } from "@/components/ui/badge";
import { Pegawai } from "@/lib/supabase";

interface LeaveRequestSubmission {
  user_id: number;
  type: string;
  start_date: string;
  end_date: string;
  reason: string;
  supervisor_id: number | null;
  authorized_officer_id: number | null;
  workingdays: number;
  address: string;
  phone: string;
  status: string;
  supervisor_status: string;
  authorized_officer_status: string;
  supervisor_viewed: boolean;
  authorized_officer_viewed: boolean;
  supervisor_signed: boolean;
  authorized_officer_signed: boolean;
  supervisor_signature_date: string | null;
  authorized_officer_signature_date: string | null;
  rejection_reason: string | null;
  leave_year: number;
  used_n2_year?: number;
  used_carry_over_days?: number;
  used_current_year_days?: number;
  saldo_n2_year: number;
  saldo_carry: number;
  saldo_current_year: number;
  link_file?: string | null;
  file_lampiran?: string | null;
}

// Update the interface to include mode for different views
interface LeaveRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: any) => void;
  mode?: "create" | "view" | "approve"; // Add mode to handle different views
  requestData?: any; // Add requestData for viewing/approving existing requests
  approverType?: "supervisor" | "authorized_officer"; // Specify which level of approval is being done
}

export function LeaveRequestModal({
  isOpen,
  onClose,
  onSubmit,
  mode = "create",
  requestData,
  approverType,
}: LeaveRequestModalProps) {
  // Jika requestData memiliki _forcedApproverType, gunakan nilai tersebut
  const effectiveApproverType = requestData?._forcedApproverType || approverType;
  const { holidays, users, user, leaveRequests, calculateRemainingLeaveBalance } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: user?.name || "",
    nip: user?.nip?.toString() || "",
    position: user?.position || "",
    workUnit: "Subbag. Tata Usaha Kankemenag Kota Tanjungpinang",
    yearsOfService: "2 tahun",
    leaveType: "Cuti Tahunan",
    leaveReason: "",
    startDate: "",
    endDate: "",
    totalDays: 0,
    validationErrors: {
      duration: null as string | null,
    },
    workingdays: 0,
    address: "",
    phone: "",
    rejectionReason: "",
    selectedLeaveBalance: "current", // Pilihan: current, carryOver, twoYearsAgo

    // First level approver (supervisor)
    supervisorId: null as number | null,
    supervisorName: "",
    supervisorPosition: "",
    supervisorNIP: "",
    supervisorSigned: false,
    supervisorSignatureDate: "",

    // Second level approver (authorized officer)
    authorizedOfficerId: null as number | null,
    authorizedOfficerName: "",
    authorizedOfficerPosition: "",
    authorizedOfficerNIP: "",
    authorizedOfficerSigned: false,
    authorizedOfficerSignatureDate: "",

    // Tambahkan pada state formData
    usedTwoYearsAgo: 0,
    usedPrevYear: 0,
    usedCurrentYear: 0,

    // File attachment
    attachment: null as File | null,
    attachmentUrl: "",
  });

  const [holidaysInRange, setHolidaysInRange] = useState<any[]>([]);
  const [weekendsInRange, setWeekendsInRange] = useState<Date[]>([]);
  const [initialBalance, setInitialBalance] = useState(0);
  const [remainingBalance, setRemainingBalance] = useState(0);
  const [carryOverBalance, setCarryOverBalance] = useState(0);
  const [twoYearsAgoBalance, setTwoYearsAgoBalance] = useState(0);
  const [remainingCarryOverBalance, setRemainingCarryOverBalance] = useState(0);
  const [remainingTwoYearsAgoBalance, setRemainingTwoYearsAgoBalance] = useState(0);
  const [remainingCurrentYearBalance, setRemainingCurrentYearBalance] = useState(0);
  const [supervisorNIPInput, setSupervisorNIPInput] = useState("");
  const [authorizedOfficerNIPInput, setAuthorizedOfficerNIPInput] = useState("");
  const [isValidSupervisor, setIsValidSupervisor] = useState(false);
  const [isValidAuthorizedOfficer, setIsValidAuthorizedOfficer] = useState(false);
  const [isSupervisorDialogOpen, setIsSupervisorDialogOpen] = useState(false);
  const [isAuthorizedOfficerDialogOpen, setIsAuthorizedOfficerDialogOpen] = useState(false);
  const [showRejectionForm, setShowRejectionForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Let's memoize the calculateLeaveBalances function to prevent unnecessary recalculations
  const calculateLeaveBalances = useCallback(
    (userId: number) => {
      if (typeof userId !== "number")
        return {
          initialBalance: 0,
          carryOverBalance: 0,
          twoYearsAgoBalance: 0,
          remainingCarryOverBalance: 0,
          remainingTwoYearsAgoBalance: 0,
          remainingCurrentYearBalance: 0,
          remainingBalance: 0,
        };

      // Dapatkan user
      const targetUser = users.find((u) => u.id === userId);
      if (!targetUser || !targetUser.leave_balance) {
        return {
          initialBalance: 0,
          carryOverBalance: 0,
          twoYearsAgoBalance: 0,
          remainingCarryOverBalance: 0,
          remainingTwoYearsAgoBalance: 0,
          remainingCurrentYearBalance: 0,
          remainingBalance: 0,
        };
      }

      const currentYear = new Date().getFullYear();
      const previousYear = currentYear - 1;
      const twoYearsAgo = currentYear - 2;

      // Ambil saldo ASLI dari leave_balance (nilai yang tersedia, bukan sisa)
      // Tidak memberikan nilai default untuk tahun berjalan, gunakan nilai dari database atau 0
      const availableCurrentYearBalance = targetUser.leave_balance[currentYear.toString()] || 0;
      const availablePreviousYearBalance = Math.min(6, targetUser.leave_balance[previousYear.toString()] || 0);
      const availableTwoYearsAgoBalance = Math.min(6, targetUser.leave_balance[twoYearsAgo.toString()] || 0);

      // Hitung penggunaan cuti dari leaveRequests yang sudah disetujui
      const usedCurrentYear = leaveRequests
        .filter(
          (req) =>
            req.user_id === userId &&
            req.status === "Approved" &&
            req.leave_year === currentYear
        )
        .reduce((total, req) => total + (req.used_current_year_days || 0), 0);

      const usedCarryOver = leaveRequests
        .filter(
          (req) =>
            req.user_id === userId &&
            req.status === "Approved" &&
            req.leave_year === currentYear
        )
        .reduce((total, req) => total + (req.used_carry_over_days || 0), 0);

      const usedTwoYearsAgo = leaveRequests
        .filter(
          (req) =>
            req.user_id === userId &&
            req.status === "Approved" &&
            req.leave_year === currentYear
        )
        .reduce((total, req) => total + (req.used_n2_year || 0), 0);

      // Hitung saldo yang tersisa (setelah dikurangi penggunaan)
      const remainingCurrentYear = availableCurrentYearBalance
      const remainingCarryOver = availablePreviousYearBalance
      const remainingTwoYearsAgo =availableTwoYearsAgoBalance
      const remainingTotal = remainingCurrentYear + remainingCarryOver + remainingTwoYearsAgo;

      return {
        // Saldo tersedia (nilai asli dari database)
        initialBalance: availableCurrentYearBalance,
        carryOverBalance: availablePreviousYearBalance,
        twoYearsAgoBalance: availableTwoYearsAgoBalance,

        // Saldo yang tersisa (setelah dikurangi penggunaan)
        remainingCarryOverBalance: remainingCarryOver,
        remainingTwoYearsAgoBalance: remainingTwoYearsAgo,
        remainingCurrentYearBalance: remainingCurrentYear,
        remainingBalance: remainingTotal,
      };
    },
    [users, leaveRequests]
  );
  // Memoize the potential approvers lists
  const potentialSupervisors = useMemo(
    () => users.filter((u: Pegawai) => u.isapprover),
    [users]
  );

  const potentialAuthorizedOfficers = useMemo(
    () => users.filter((u: Pegawai) => u.isauthorizedofficer),
    [users]
  );

  // Initialize form data when the modal opens
  useEffect(() => {
    if (!isOpen || !user) return;

    if (mode === "create") {
      console.log("Initializing form data for create mode.");
      // For new requests, initialize with current user data, but preserve supervisor data if it exists
      setFormData((prev) => {
        // Simpan data supervisor yang mungkin sudah ada
        const existingSupervisorData = {
          supervisorId: prev.supervisorId,
          supervisorName: prev.supervisorName,
          supervisorPosition: prev.supervisorPosition,
          supervisorNIP: prev.supervisorNIP,
          supervisorSigned: prev.supervisorSigned,
          supervisorSignatureDate: prev.supervisorSignatureDate,
        };

        // Simpan juga data pejabat berwenang
        const existingAuthorizedOfficerData = {
          authorizedOfficerId: prev.authorizedOfficerId,
          authorizedOfficerName: prev.authorizedOfficerName,
          authorizedOfficerPosition: prev.authorizedOfficerPosition,
          authorizedOfficerNIP: prev.authorizedOfficerNIP,
          authorizedOfficerSigned: prev.authorizedOfficerSigned,
          authorizedOfficerSignatureDate: prev.authorizedOfficerSignatureDate,
        };

        // Hanya reset data supervisor dan officer jika benar-benar kosong
        const resetSupervisorData = prev.supervisorId === null;
        const resetOfficerData = prev.authorizedOfficerId === null;

        // Format masa kerja dari database jika tersedia
        let formattedMasaKerja = "";
        if (user.masa_kerja) {
          // Jika masa_kerja adalah string tanggal, konversi ke format yang sesuai
          try {
            const masaKerjaDate = new Date(user.masa_kerja);
            const today = new Date();
            const yearDiff = today.getFullYear() - masaKerjaDate.getFullYear();
            formattedMasaKerja = `${yearDiff} tahun`;
          } catch (e) {
            // Jika gagal parsing, gunakan nilai asli
            formattedMasaKerja = user.masa_kerja;
          }
        } else {
          formattedMasaKerja = "0 tahun";
        }

        return {
          ...prev,
          name: user.name || "",
          nip: user.nip?.toString() || "",
          position: user.position || "",
          workUnit: user.workunit || "Subbag. Tata Usaha Kankemenag Kota Tanjungpinang",
          yearsOfService: formattedMasaKerja, // Gunakan masa kerja dari database
          leaveType: "Cuti Tahunan",

          // Gunakan data supervisor yang sudah ada jika ada
          ...(resetSupervisorData
            ? {
                supervisorId: null,
                supervisorName: "",
                supervisorPosition: "",
                supervisorNIP: "",
                supervisorSigned: false,
                supervisorSignatureDate: "",
              }
            : existingSupervisorData),

          // Gunakan data officer yang sudah ada jika ada
          ...(resetOfficerData
            ? {
                authorizedOfficerId: null,
                authorizedOfficerName: "",
                authorizedOfficerPosition: "",
                authorizedOfficerNIP: "",
                authorizedOfficerSigned: false,
                authorizedOfficerSignatureDate: "",
              }
            : existingAuthorizedOfficerData),

          rejectionReason: "",
        };
      });

      // Reset validation states
      setIsValidSupervisor(false);
      setIsValidAuthorizedOfficer(false);
      setSupervisorNIPInput("");
      setAuthorizedOfficerNIPInput("");
      setShowRejectionForm(false);

      // Calculate leave balances when the modal opens
      if (user.id) {
        const balances = calculateLeaveBalances(user.id);
        if (typeof balances !== "number") {
          setInitialBalance(balances.initialBalance);
          setCarryOverBalance(balances.carryOverBalance);
          setTwoYearsAgoBalance(balances.twoYearsAgoBalance);
          setRemainingBalance(balances.remainingBalance);
          setRemainingCarryOverBalance(balances.remainingCarryOverBalance);
          setRemainingTwoYearsAgoBalance(balances.remainingTwoYearsAgoBalance);
          setRemainingCurrentYearBalance(balances.remainingCurrentYearBalance);
        }
      }
    } else if ((mode === "view" || mode === "approve") && requestData) {
      console.log("Initializing form data for view/approve mode.");
      // For viewing or approving existing requests, load data from requestData
      const requester = users.find((u) => u.id === requestData.user_id);
      const supervisor = users.find((u) => u.id === requestData.supervisor_id);
      const authorizedOfficer = users.find((u) => u.id === requestData.authorized_officer_id);

      // Format masa kerja dari database jika tersedia
      let formattedMasaKerja = "";
      if (requester?.masa_kerja) {
        // Jika masa_kerja adalah string tanggal, konversi ke format yang sesuai
        try {
          const masaKerjaDate = new Date(requester.masa_kerja);
          const today = new Date();
          const yearDiff = today.getFullYear() - masaKerjaDate.getFullYear();
          formattedMasaKerja = `${yearDiff} tahun`;
        } catch (e) {
          // Jika gagal parsing, gunakan nilai asli
          formattedMasaKerja = requester.masa_kerja;
        }
      } else {
        formattedMasaKerja = "0 tahun";
      }

      setFormData((prev) => ({
        ...prev,
        name: requester?.name || "",
        nip: requester?.nip?.toString() || "",
        position: requester?.position || "",
        workUnit: requester?.workunit || "Subbag. Tata Usaha Kankemenag Kota Tanjungpinang",
        yearsOfService: formattedMasaKerja, // Gunakan masa kerja dari database
        leaveType: requestData.type || "Cuti Tahunan",
        leaveReason: requestData.reason || "",
        startDate: requestData.start_date || "",
        endDate: requestData.end_date || "",
        totalDays: requestData.totalDays || 0,
        workingdays: requestData.workingDays || 0,
        address: requestData.address || "",
        phone: requestData.phone || "",
        rejectionReason: requestData.rejection_reason || "",

        // Preserve existing signature states if they exist, otherwise use request data
        supervisorId: requestData.supervisor_id,
        supervisorName: supervisor?.name || "",
        supervisorPosition: supervisor?.position || "",
        supervisorNIP: supervisor?.nip?.toString() || "",
        supervisorSigned: prev.supervisorSigned || requestData.supervisor_signed || false,
        supervisorSignatureDate:
          prev.supervisorSignatureDate || requestData.supervisor_signature_date || "",

        authorizedOfficerId: requestData.authorized_officer_id,
        authorizedOfficerName: authorizedOfficer?.name || "",
        authorizedOfficerPosition: authorizedOfficer?.position || "",
        authorizedOfficerNIP: authorizedOfficer?.nip?.toString() || "",
        authorizedOfficerSigned:
          prev.authorizedOfficerSigned || requestData.authorized_officer_signed || false,
        authorizedOfficerSignatureDate:
          prev.authorizedOfficerSignatureDate ||
          requestData.authorized_officer_signature_date ||
          "",
      }));

      // Calculate leave balances for the requester
      if (requester && requester.id) {
        const balances = calculateLeaveBalances(requester.id);
        if (typeof balances !== "number") {
          setInitialBalance(balances.initialBalance);
          setCarryOverBalance(balances.carryOverBalance);
          setTwoYearsAgoBalance(balances.twoYearsAgoBalance);
          setRemainingBalance(balances.remainingBalance);
          setRemainingCarryOverBalance(balances.remainingCarryOverBalance);
          setRemainingTwoYearsAgoBalance(balances.remainingTwoYearsAgoBalance);
          setRemainingCurrentYearBalance(balances.remainingCurrentYearBalance);
        }
      }
    }
  }, [
    isOpen,
    user,
    users,
    leaveRequests,
    mode,
    requestData,
    approverType,
    calculateLeaveBalances,
  ]);

  useEffect(() => {
    console.log("Form data updated:", formData);
  }, [formData]);

  // Handle form field changes
  const handleChange = (field: string, value: any) => {
    console.log(`Changing field ${field} to`, value);
    setFormData((prev) => {
      const updatedData = {
        ...prev,
        [field]: value,
      };

      // Validasi durasi cuti saat mengubah jenis cuti atau tanggal
      if (
        (field === "leaveType" &&
          (value === "Cuti Besar" || value === "Cuti Melahirkan") &&
          prev.totalDays > 90) ||
        ((field === "startDate" || field === "endDate") &&
          (prev.leaveType === "Cuti Besar" || prev.leaveType === "Cuti Melahirkan") &&
          prev.totalDays > 90)
      ) {
        // Update validation errors
        updatedData.validationErrors = {
          ...prev.validationErrors,
          duration: `${
            field === "leaveType" ? value : prev.leaveType
          } tidak boleh lebih dari 90 hari kalender`,
        };

        toast({
          title: "Durasi cuti melebihi batas",
          description: `${
            field === "leaveType" ? value : prev.leaveType
          } tidak boleh lebih dari 90 hari kalender`,
          variant: "destructive",
        });
      } else if (field === "leaveType" || field === "startDate" || field === "endDate") {
        // Reset validation error when changing leave type to non-restricted type
        // or when changing dates
        updatedData.validationErrors = {
          ...prev.validationErrors,
          duration: null,
        };
      }

      return updatedData;
    });
  };

  // Handle leave calculation results
  const handleLeaveCalculation = (
    totalDays: number,
    workingDays: number,
    weekends: Date[],
    holidaysInRange: any[]
  ) => {
    console.log("Updating leave calculation results:", { totalDays, workingDays });

    // Pastikan workingDays adalah angka positif
    const validWorkingDays = Math.max(0, workingDays);

    setFormData((prev) => ({
      ...prev,
      totalDays,
      workingdays: validWorkingDays,
    }));
    setHolidaysInRange(holidaysInRange);
    setWeekendsInRange(weekends);

    // Validasi real-time untuk cuti besar dan cuti melahirkan
    if (
      (formData.leaveType === "Cuti Besar" || formData.leaveType === "Cuti Melahirkan") &&
      totalDays > 90
    ) {
      toast({
        title: "Durasi Cuti Melebihi Batas",
        description: `${formData.leaveType} tidak boleh lebih dari 90 hari kalender. Durasi yang dipilih: ${totalDays} hari.`,
        variant: "destructive",
      });
    }
  };

  // Toggle supervisor signature
  const toggleSupervisorSignature = useCallback(() => {
    setFormData((prev) => {
      const newSignedState = !prev.supervisorSigned;
      return {
        ...prev,
        supervisorSigned: newSignedState,
        supervisorSignatureDate: newSignedState ? new Date().toISOString() : "",
      };
    });

    toast({
      title: "Dokumen ditandatangani",
      description: "Dokumen telah berhasil ditandatangani",
    });
  }, [toast]);

  // Toggle authorized officer signature
  const toggleAuthorizedOfficerSignature = () => {
    setFormData((prev) => {
      const newSignedState = !prev.authorizedOfficerSigned;
      return {
        ...prev,
        authorizedOfficerSigned: newSignedState,
        authorizedOfficerSignatureDate: newSignedState ? new Date().toISOString() : "",
      };
    });

    toast({
      title: "Dokumen ditandatangani",
      description: "Dokumen telah berhasil ditandatangani",
    });
  };

  // Handle supervisor selection
  const handleSupervisorSelect = (supervisorId: number) => {
    console.log("handleSupervisorSelect called with supervisorId:", supervisorId);
    if (!users.length) {
      console.warn("Users not loaded yet.");
      return;
    }

    // Cari supervisor berdasarkan ID
    const selectedSupervisor = users.find((a) => a.id === supervisorId);

    if (!selectedSupervisor) {
      console.warn("Supervisor not found.");
      return;
    }

    console.log("Selecting supervisor:", selectedSupervisor);

    // Segera perbarui formData dengan fungsi updater
    setFormData((prev) => {
      // Buat objek data baru dengan supervisor yang dipilih
      const newData = {
        ...prev,
        supervisorId: supervisorId,
        supervisorName: selectedSupervisor.name || "",
        supervisorPosition: selectedSupervisor.position || "",
        supervisorNIP: selectedSupervisor.nip || "",
      };
      console.log("Updating form data with:", newData);
      return newData;
    });

    // Tutup dialog setelah data diperbarui
    setTimeout(() => {
      setIsSupervisorDialogOpen(false);

      // Tampilkan toast setelah dialog ditutup
      toast({
        title: "Atasan Langsung dipilih",
        description: `${selectedSupervisor.name} telah dipilih sebagai Atasan Langsung`,
      });
    }, 100);
  };

  // Handle authorized officer selection
  const handleAuthorizedOfficerSelect = (officerId: number) => {
    console.log("handleAuthorizedOfficerSelect called with officerId:", officerId);
    if (!users.length) {
      console.warn("Users not loaded yet.");
      return;
    }

    const selectedOfficer = users.find((a) => a.id === officerId);

    if (!selectedOfficer) {
      console.warn("Authorized officer not found.");
      return;
    }

    console.log("Selecting authorized officer:", selectedOfficer);

    // Segera perbarui formData dengan fungsi updater
    setFormData((prev) => {
      // Buat objek data baru dengan officer yang dipilih
      const newData = {
        ...prev,
        authorizedOfficerId: officerId,
        authorizedOfficerName: selectedOfficer.name || "",
        authorizedOfficerPosition: selectedOfficer.position || "",
        authorizedOfficerNIP: selectedOfficer.nip || "",
      };
      console.log("Updating authorized officer form data with:", newData);
      return newData;
    });

    // Tutup dialog setelah data diperbarui
    setTimeout(() => {
      setIsAuthorizedOfficerDialogOpen(false);

      // Tampilkan toast setelah dialog ditutup
      toast({
        title: "Pejabat Berwenang dipilih",
        description: `${selectedOfficer.name} telah dipilih sebagai Pejabat yang Berwenang`,
      });
    }, 100);
  };

  // Handle supervisor NIP input
  const handleSupervisorNIPInput = (nip: string) => {
    console.log("Handling supervisor NIP input:", nip);
    setFormData((prev) => ({
      ...prev,
      supervisorNIP: nip,
    }));

    // Find supervisor by NIP
    const supervisor = users.find((u) => u.id.toString() === nip && u.isapprover === true);
    if (supervisor) {
      console.log("Supervisor found by NIP:", supervisor);
      setFormData((prev) => ({
        ...prev,
        supervisorId: supervisor.id,
        supervisorName: supervisor.name,
        supervisorPosition: supervisor.position || "",
      }));
    } else {
      console.log("No supervisor found by NIP.");
      setFormData((prev) => ({
        ...prev,
        supervisorId: null,
        supervisorName: "",
        supervisorPosition: "",
      }));
    }
  };

  // Handle authorized officer NIP input
  const handleAuthorizedOfficerNIPInput = (nip: string) => {
    console.log("Handling authorized officer NIP input:", nip);
    setFormData((prev) => ({
      ...prev,
      authorizedOfficerNIP: nip,
    }));

    // Find authorized officer by NIP
    const officer = users.find((u) => u.id.toString() === nip && u.isauthorizedofficer);
    if (officer) {
      console.log("Authorized officer found by NIP:", officer);
      setFormData((prev) => ({
        ...prev,
        authorizedOfficerId: officer.id,
        authorizedOfficerName: officer.name,
        authorizedOfficerPosition: officer.position || "",
      }));
    } else {
      console.log("No authorized officer found by NIP.");
      setFormData((prev) => ({
        ...prev,
        authorizedOfficerId: null,
        authorizedOfficerName: "",
        authorizedOfficerPosition: "",
      }));
    }
  };

  // Fungsi validasi input saldo cuti
  const validateLeaveUsage = (
    usedTwoYearsAgo: number,
    usedPrevYear: number,
    usedCurrentYear: number
  ) => {
    // Jika bukan Cuti Tahunan, tidak perlu validasi saldo
    if (formData.leaveType !== "Cuti Tahunan") {
      return [];
    }

    const totalUsed = usedTwoYearsAgo + usedPrevYear + usedCurrentYear;
    const errors: string[] = [];

    if (totalUsed !== formData.workingdays) {
      errors.push(
        `Total penggunaan saldo (${totalUsed} hari) harus sama dengan jumlah hari cuti yang diajukan (${formData.workingdays} hari).`
      );
    }

    if (usedTwoYearsAgo > remainingTwoYearsAgoBalance) {
      errors.push(
        `Penggunaan saldo tahun N-2 tidak boleh lebih dari ${remainingTwoYearsAgoBalance} hari.`
      );
    }

    if (usedPrevYear > remainingCarryOverBalance) {
      errors.push(
        `Penggunaan saldo tahun N-1 tidak boleh lebih dari ${remainingCarryOverBalance} hari.`
      );
    }

    if (usedCurrentYear > remainingCurrentYearBalance) {
      errors.push(
        `Penggunaan saldo tahun berjalan tidak boleh lebih dari ${remainingCurrentYearBalance} hari.`
      );
    }

    return errors;
  };

  // Handler perubahan input saldo cuti per tahun
  const handleLeaveUsageChange = (
    field: "usedTwoYearsAgo" | "usedPrevYear" | "usedCurrentYear",
    value: number
  ) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value };
      return newData;
    });
  };

  // Handler untuk upload file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      // Validasi ukuran file
      if (
        (formData.leaveType === "Cuti Besar" || formData.leaveType === "Cuti Sakit") &&
        file.size > 2 * 1024 * 1024
      ) {
        toast({
          title: "Ukuran file terlalu besar",
          description: `Ukuran file maksimal untuk ${formData.leaveType} adalah 2MB`,
          variant: "destructive",
        });
        e.target.value = "";
        return;
      } else if (formData.leaveType === "Cuti Melahirkan" && file.size > 2 * 1024 * 1024) {
        toast({
          title: "Ukuran file terlalu besar",
          description: "Ukuran file maksimal adalah 2MB",
          variant: "destructive",
        });
        e.target.value = "";
        return;
      }

      // Validasi format file untuk Cuti Besar dan Cuti Sakit
      if (
        (formData.leaveType === "Cuti Besar" || formData.leaveType === "Cuti Sakit") &&
        !file.type.includes("pdf")
      ) {
        toast({
          title: "Format file tidak didukung",
          description: `Hanya file PDF yang diperbolehkan untuk ${formData.leaveType}`,
          variant: "destructive",
        });
        e.target.value = "";
        return;
      }

      setFormData((prev) => ({
        ...prev,
        attachment: file,
      }));
    }
  };

  // Handler untuk perubahan pilihan saldo
  const handleSelectedLeaveBalanceChange = (value: string) => {
    setFormData((prev) => {
      const workingDays = prev.workingdays || 0;
      let usedTwoYearsAgo = 0;
      let usedPrevYear = 0;
      let usedCurrentYear = 0;

      switch (value) {
        case "twoYearsAgo":
          usedTwoYearsAgo = Math.min(remainingTwoYearsAgoBalance, workingDays);
          break;
        case "carryOver":
          usedPrevYear = Math.min(remainingCarryOverBalance, workingDays);
          break;
        case "current":
          usedCurrentYear = Math.min(remainingCurrentYearBalance, workingDays);
          break;
      }

      return {
        ...prev,
        selectedLeaveBalance: value,
        usedTwoYearsAgo,
        usedPrevYear,
        usedCurrentYear,
      };
    });
  };

  // Handle form submission for new leave request
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (!user?.id) {
        throw new Error("User ID tidak ditemukan");
      }

      if (!formData.startDate) {
        throw new Error("Tanggal mulai harus diisi");
      }

      if (!formData.endDate) {
        throw new Error("Tanggal selesai harus diisi");
      }

      // Validasi batas 90 hari kalender untuk cuti besar dan cuti melahirkan
      if (
        (formData.leaveType === "Cuti Besar" || formData.leaveType === "Cuti Melahirkan") &&
        formData.totalDays > 90
      ) {
        toast({
          title: "Durasi cuti melebihi batas",
          description: `${formData.leaveType} tidak boleh lebih dari 90 hari kalender`,
          variant: "destructive",
        });

        // Update validation errors
        setFormData((prev) => ({
          ...prev,
          validationErrors: {
            ...prev.validationErrors,
            duration: `${formData.leaveType} tidak boleh lebih dari 90 hari kalender`,
          },
        }));

        setIsSubmitting(false);
        return;
      }

      if (!formData.supervisorId) {
        throw new Error("Atasan Langsung harus dipilih");
      }

      if (!formData.authorizedOfficerId) {
        throw new Error("Pejabat Berwenang harus dipilih");
      }

      // Validasi workingdays
      const workingDays = parseInt(formData.workingdays.toString());
      if (isNaN(workingDays) || workingDays <= 0) {
        throw new Error("Total hari kerja harus lebih dari 0");
      }

      if (!formData.leaveReason) {
        throw new Error("Alasan cuti harus diisi");
      }

      if (!formData.address) {
        throw new Error("Alamat selama cuti harus diisi");
      }

      if (!formData.phone) {
        throw new Error("Nomor telepon harus diisi");
      }

      // Validasi file lampiran
      if (
        !formData.attachment &&
        (formData.leaveType === "Cuti Sakit" ||
          formData.leaveType === "Cuti Melahirkan" ||
          formData.leaveType === "Cuti Besar")
      ) {
        throw new Error("Lampiran harus diunggah untuk jenis cuti ini");
      }

      // Tutup modal terlebih dahulu sebelum melakukan proses pengiriman data
      onClose();

      // Tampilkan toast bahwa proses sedang berjalan
      toast({
        title: "Mengirim pengajuan cuti...",
        description: "Proses akan dilanjutkan di latar belakang",
      });

      // Lanjutkan proses di background
      setTimeout(async () => {
        try {
          // Upload file jika ada
          let fileUrl = "";
          if (formData.attachment) {
            const fileName = `${user.id}_${Date.now()}_${formData.attachment.name}`;
            const formData2 = new FormData();
            formData2.append("file", formData.attachment);

            try {
              const uploadResponse = await fetch(
                `/api/upload?fileName=${encodeURIComponent(fileName)}&bucket=lampiran`,
                {
                  method: "POST",
                  body: formData2,
                }
              );

              if (!uploadResponse.ok) {
                throw new Error("Gagal mengunggah file");
              }

              const uploadResult = await uploadResponse.json();
              fileUrl = uploadResult.url;
            } catch (error) {
              console.error("Error uploading file:", error);
              throw new Error("Gagal mengunggah file lampiran");
            }
          }

          // Prepare data for submission
          const submissionData: LeaveRequestSubmission = {
            user_id: user.id,
            type: formData.leaveType,
            start_date: formData.startDate,
            end_date: formData.endDate,
            reason: formData.leaveReason,
            supervisor_id: formData.supervisorId,
            authorized_officer_id: formData.authorizedOfficerId,
            workingdays: workingDays,
            address: formData.address,
            phone: formData.phone,
            status: "Pending",
            supervisor_status: "Pending",
            authorized_officer_status: "Pending",
            supervisor_viewed: false,
            link_file: fileUrl || null,
            file_lampiran: fileUrl || null,
            authorized_officer_viewed: false,
            supervisor_signed: false,
            authorized_officer_signed: false,
            supervisor_signature_date: null,
            authorized_officer_signature_date: null,
            rejection_reason: null,
            leave_year: new Date(formData.startDate).getFullYear(),
            saldo_n2_year: twoYearsAgoBalance,
            saldo_carry: carryOverBalance,
            saldo_current_year: initialBalance,
          };

          // Hitung penggunaan saldo cuti berdasarkan input manual pengguna
          if (formData.leaveType === "Cuti Tahunan") {
            // Gunakan input manual dari pengguna
            let usedTwoYearsAgo = formData.usedTwoYearsAgo || 0;
            let usedCarryOver = formData.usedPrevYear || 0;
            let usedCurrentYear = formData.usedCurrentYear || 0;

            // Jika input manual kosong, gunakan logika otomatis berdasarkan pilihan
            if (usedTwoYearsAgo === 0 && usedCarryOver === 0 && usedCurrentYear === 0) {
              // Tentukan penggunaan saldo berdasarkan pilihan pengguna
              switch (formData.selectedLeaveBalance) {
                case "twoYearsAgo":
                  usedTwoYearsAgo = Math.min(remainingTwoYearsAgoBalance, workingDays);
                  break;
                case "carryOver":
                  usedCarryOver = Math.min(remainingCarryOverBalance, workingDays);
                  break;
                case "current":
                  usedCurrentYear = Math.min(remainingCurrentYearBalance, workingDays);
                  break;
              }
            }

            // Validasi akan dilakukan oleh validateLeaveUsage
            const totalUsed = usedTwoYearsAgo + usedCarryOver + usedCurrentYear;
            console.log(
              `Total penggunaan saldo: ${totalUsed} hari, Hari kerja: ${workingDays} hari`
            );
            console.log(
              `Saldo N-2: ${remainingTwoYearsAgoBalance} hari, Penggunaan: ${usedTwoYearsAgo} hari`
            );
            console.log(
              `Saldo N-1: ${remainingCarryOverBalance} hari, Penggunaan: ${usedCarryOver} hari`
            );
            console.log(
              `Saldo tahun berjalan: ${remainingCurrentYearBalance} hari, Penggunaan: ${usedCurrentYear} hari`
            );

            // Tambahkan data penggunaan saldo ke submissionData
            submissionData.used_n2_year = usedTwoYearsAgo;
            submissionData.used_carry_over_days = usedCarryOver;
            submissionData.used_current_year_days = usedCurrentYear;
            submissionData.saldo_n2_year = twoYearsAgoBalance; // Saldo awal, bukan sisa
            submissionData.saldo_carry = carryOverBalance; // Saldo awal, bukan sisa
            submissionData.saldo_current_year = initialBalance; // Saldo awal, bukan sisa

            console.log("Detail penggunaan saldo:", {
              workingDays,
              selectedBalance: formData.selectedLeaveBalance,
              usedTwoYearsAgo,
              usedCarryOver,
              usedCurrentYear,
              totalUsed,
              twoYearsAgoBalance,
              carryOverBalance,
              initialBalance,
              remainingTwoYearsAgoBalance,
              remainingCarryOverBalance,
              remainingCurrentYearBalance,
            });
          } else {
            // Untuk jenis cuti selain Cuti Tahunan, set nilai penggunaan saldo ke 0
            submissionData.used_n2_year = 0;
            submissionData.used_carry_over_days = 0;
            submissionData.used_current_year_days = 0;
            submissionData.saldo_n2_year = twoYearsAgoBalance;
            submissionData.saldo_carry = carryOverBalance;
            submissionData.saldo_current_year = initialBalance;
          }

          // Validasi penggunaan saldo cuti
          // Pastikan nilai yang divalidasi adalah nilai yang akan digunakan dalam submissionData
          const usageErrors = validateLeaveUsage(
            submissionData.used_n2_year,
            submissionData.used_carry_over_days,
            submissionData.used_current_year_days
          );
          if (usageErrors.length > 0) {
            throw new Error(usageErrors.join("\n"));
          }

          console.log("Mengirim data permintaan cuti:", submissionData);

          // Send data to API
          const response = await fetch("/api/leave-requests", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(submissionData),
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.error || result.message || "Gagal mengirim permintaan cuti");
          }

          // Trigger refresh event
          window.dispatchEvent(new Event("leave-request-updated"));

          toast({
            title: "Berhasil!",
            description: "Pengajuan cuti telah dikirim dan menunggu persetujuan.",
          });
        } catch (err) {
          console.error("Error submitting leave request:", err);
          toast({
            title: "Gagal mengirim permintaan",
            description: err instanceof Error ? err.message : "Gagal mengirim permintaan cuti",
            variant: "destructive",
          });
        } finally {
          setIsSubmitting(false);
        }
      }, 100);
    } catch (err) {
      console.error("Error validating form:", err);
      toast({
        title: "Gagal memvalidasi form",
        description: err instanceof Error ? err.message : "Gagal memvalidasi form permintaan cuti",
        variant: "destructive",
      });
      setError(err instanceof Error ? err.message : "Gagal memvalidasi form permintaan cuti");
      setIsSubmitting(false);
    }
  };

  // Handle approval/rejection by a supervisor
  const handleSupervisorAction = async (action: "Approved" | "Rejected") => {
    try {
      if (!requestData || !requestData.id) {
        console.error("Invalid request data or missing ID:", requestData);
        toast({
          title: "Error",
          description: "Data permintaan tidak valid. Silakan muat ulang halaman.",
          variant: "destructive",
        });
        return;
      }

      const approvalData = {
        leaveRequestId: requestData.id,
        action,
        type: "supervisor",
        rejectionReason: action === "Rejected" ? formData.rejectionReason : undefined,
        signatureDate: action === "Approved" ? formData.supervisorSignatureDate : undefined,
        signed: action === "Approved" ? formData.supervisorSigned : false,
      };

      // Tutup modal terlebih dahulu
      onClose();

      // Tampilkan toast bahwa proses sedang berjalan
      toast({
        title: action === "Approved" ? "Menyetujui permintaan..." : "Menolak permintaan...",
        description: "Proses akan dilanjutkan di latar belakang",
      });

      // Kirim data secara asynchronous
      setTimeout(() => {
        onSubmit(approvalData);
      }, 100);
    } catch (error) {
      console.error("Error in supervisor action:", error);
      toast({
        title: "Gagal memproses permintaan",
        description: "Terjadi kesalahan saat memproses permintaan cuti.",
        variant: "destructive",
      });
    }
  };

  // Handle approval/rejection by an authorized officer
  const handleAuthorizedOfficerAction = (status: "Approved" | "Rejected") => {
    console.log("Handling authorized officer action:", status);
    if (!formData.authorizedOfficerSigned) {
      toast({
        title: "Tanda tangan diperlukan",
        description: "Anda harus menandatangani dokumen sebelum menyetujui",
        variant: "destructive",
      });
      return;
    }

    if (status === "Rejected" && !formData.rejectionReason && !showRejectionForm) {
      setShowRejectionForm(true);
      return;
    }

    // Check if a rejection reason is provided if rejecting
    if (status === "Rejected" && !formData.rejectionReason) {
      toast({
        title: "Alasan penolakan diperlukan",
        description: "Harap berikan alasan untuk penolakan permintaan cuti",
        variant: "destructive",
      });
      return;
    }

    // Verifikasi ID permintaan
    if (!requestData || !requestData.id) {
      console.error("Invalid request data or missing ID:", requestData);
      toast({
        title: "Error",
        description: "Data permintaan tidak valid. Silakan muat ulang halaman.",
        variant: "destructive",
      });
      return;
    }

    // Prepare data for submission
    const approvalData = {
      leaveRequestId: requestData.id,
      action: status,
      type: "authorized_officer",
      rejectionReason: status === "Rejected" ? formData.rejectionReason : undefined,
      signatureDate:
        status === "Approved" ? formData.authorizedOfficerSignatureDate : undefined,
      signed: status === "Approved" ? formData.authorizedOfficerSigned : false,
    };

    // Tutup modal terlebih dahulu
    onClose();

    // Tampilkan toast bahwa proses sedang berjalan
    toast({
      title: status === "Approved" ? "Menyetujui permintaan..." : "Menolak permintaan...",
      description: "Proses akan dilanjutkan di latar belakang",
    });

    // Kirim data secara asynchronous
    setTimeout(() => {
      onSubmit(approvalData);
    }, 100);
  };

  // Render approval status component
  const renderApprovalStatus = () => {
    if (mode === "view" || mode === "approve") {
      const supervisorStatus = requestData?.supervisor_status || "Pending";
      const authorizedOfficerStatus = requestData?.authorized_officer_status || "Pending";

      return (
        <div className="border rounded-md p-4 space-y-4">
          <h3 className="font-medium">Status Persetujuan:</h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <div className="flex items-center">
                <Badge
                  className={
                    supervisorStatus === "Approved"
                      ? "bg-green-500"
                      : supervisorStatus === "Rejected"
                      ? "bg-red-500"
                      : "bg-yellow-500"
                  }
                >
                  {supervisorStatus === "Approved"
                    ? "Disetujui"
                    : supervisorStatus === "Rejected"
                    ? "Ditolak"
                    : "Menunggu"}
                </Badge>
                <span className="ml-2">Atasan Langsung</span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className="flex items-center">
                <Badge
                  className={
                    authorizedOfficerStatus === "Approved"
                      ? "bg-green-500"
                      : authorizedOfficerStatus === "Rejected"
                      ? "bg-red-500"
                      : "bg-yellow-500"
                  }
                >
                  {authorizedOfficerStatus === "Approved"
                    ? "Disetujui"
                    : authorizedOfficerStatus === "Rejected"
                    ? "Ditolak"
                    : "Menunggu"}
                </Badge>
                <span className="ml-2">Pejabat Yang Berwenang</span>
              </div>
            </div>
          </div>

          {requestData?.rejection_reason && (
            <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded">
              <div className="text-sm font-medium text-red-700">Alasan Penolakan:</div>
              <div className="text-sm text-red-600">{requestData.rejection_reason}</div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-[800px] p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Formulir Permintaan dan Pemberian Cuti</DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "Isi formulir berikut untuk mengajukan permintaan cuti"
                : mode === "view"
                ? "Detail permintaan cuti"
                : "Review dan proses permintaan cuti"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Approval Status - visible in view/approve mode */}
            {renderApprovalStatus()}

            {/* Group I: Employee Data */}
            <div className="border rounded-md overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 font-medium">I. DATA PEGAWAI</div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Nama</Label>
                    <Input id="name" value={formData.name} readOnly className="bg-gray-50" />
                  </div>
                  <div>
                    <Label htmlFor="nip">NIP</Label>
                    <Input id="nip" value={formData.nip} readOnly className="bg-gray-50" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="position">Jabatan</Label>
                    <Input
                      id="position"
                      value={formData.position}
                      readOnly
                      className="bg-gray-50"
                    />
                  </div>
                  <div>
                    <Label htmlFor="years-service">Masa Kerja</Label>
                    <Input
                      id="years-service"
                      value={formData.yearsOfService}
                      readOnly
                      className="bg-gray-50"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="work-unit">Unit Kerja</Label>
                  <Input
                    id="work-unit"
                    value={formData.workUnit}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>
              </div>
            </div>

            {/* Group II: Leave Type */}
            <div className="border rounded-md overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 font-medium">
                II. JENIS CUTI YANG DIAMBIL
              </div>
              <div className="p-4">
                <RadioGroup
                  value={formData.leaveType}
                  onValueChange={(value) => handleChange("leaveType", value)}
                  className="grid grid-cols-1 md:grid-cols-2 gap-2"
                  disabled={mode !== "create"}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Cuti Tahunan" id="leave-type-1" />
                    <Label htmlFor="leave-type-1">Cuti Tahunan</Label>
                  </div>
                  {user?.tipe_pengguna == "PPPK" && (
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Cuti Besar" id="leave-type-2" />
                    <Label htmlFor="leave-type-2">Cuti Besar</Label>
                  </div>
                  )}
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Cuti Sakit" id="leave-type-3" />
                    <Label htmlFor="leave-type-3">Cuti Sakit</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Cuti Melahirkan" id="leave-type-4" />
                    <Label htmlFor="leave-type-4">Cuti Melahirkan</Label>
                  </div>
                  {user?.tipe_pengguna !== "PPPK" && (
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Cuti Karena Alasan Penting" id="leave-type-5" />
                    <Label htmlFor="leave-type-5">Cuti Karena Alasan Penting</Label>
                  </div>
                  )}
                  {user?.tipe_pengguna !== "PPPK" && (
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Cuti di Luar Tanggungan Negara" id="leave-type-6" />
                    <Label htmlFor="leave-type-6">Cuti di Luar Tanggungan Negara</Label>
                  </div>
                  )}
                </RadioGroup>
              </div>
            </div>

            {/* File Upload Component - Only shown for specific leave types */}
            {mode === "create" &&
              (formData.leaveType === "Cuti Sakit" ||
                formData.leaveType === "Cuti Melahirkan" ||
                formData.leaveType === "Cuti Besar") && (
                <div className="border rounded-md overflow-hidden">
                  <div className="bg-gray-100 px-4 py-2 font-medium">LAMPIRAN DOKUMEN</div>
                  <div className="p-4">
                    <div className="mb-2">
                      <Label htmlFor="attachment">
                        Unggah Dokumen Pendukung
                        {formData.leaveType === "Cuti Sakit"
                          ? "(Surat Keterangan Dokter)"
                          : formData.leaveType === "Cuti Melahirkan"
                          ? "(Surat Keterangan Melahirkan)"
                          : "(Dokumen Pendukung Cuti Besar)"}
                      </Label>
                      <div className="mt-1">
                        <Input
                          id="attachment"
                          type="file"
                          onChange={handleFileUpload}
                          accept={
                            formData.leaveType === "Cuti Besar" ||
                            formData.leaveType === "Cuti Sakit"
                              ? ".pdf"
                              : ".pdf,.jpg,.jpeg,.png"
                          }
                        />
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {formData.leaveType === "Cuti Besar" ||
                        formData.leaveType === "Cuti Sakit"
                          ? "Format yang didukung: PDF (Maks. 2MB)"
                          : "Format yang didukung: PDF, JPG, JPEG, PNG (Maks. 2MB)"}
                      </p>
                      {formData.attachment && (
                        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded flex items-center justify-between">
                          <span className="text-sm text-green-700">
                            File dipilih: {formData.attachment.name}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleChange("attachment", null)}
                            className="h-6 w-6 p-0 text-red-500"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

            {/* Group III: Leave Reason */}
            <div className="border rounded-md overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 font-medium">III. ALASAN CUTI</div>
              <div className="p-4">
                <Textarea
                  value={formData.leaveReason}
                  onChange={(e) => handleChange("leaveReason", e.target.value)}
                  placeholder="Masukkan alasan cuti"
                  rows={3}
                  readOnly={mode !== "create"}
                  className={mode !== "create" ? "bg-gray-50" : ""}
                />

                {/* Tombol Lihat Lampiran - hanya tampil di mode view/approve jika ada file lampiran */}
                {(mode === "view" || mode === "approve") && requestData?.file_lampiran && (
                  <div className="mt-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        console.log("Opening file lampiran:", requestData.file_lampiran);
                        window.open(requestData.file_lampiran, "_blank");
                      }}
                      className="flex items-center gap-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Lihat Lampiran
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Group IV: Leave Duration */}
            <div className="border rounded-md overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 font-medium">IV. LAMANYA CUTI</div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="start-date">Mulai Tanggal</Label>
                    <div className="relative">
                      <Input
                        id="start-date"
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => handleChange("startDate", e.target.value)}
                        readOnly={mode !== "create"}
                        className={mode !== "create" ? "bg-gray-50" : ""}
                      />
                      {/* <Calendar className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" /> */}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="end-date">Sampai Dengan</Label>
                    <div className="relative">
                      <Input
                        id="end-date"
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => handleChange("endDate", e.target.value)}
                        readOnly={mode !== "create"}
                        className={mode !== "create" ? "bg-gray-50" : ""}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="total-days">Total Cuti</Label>
                    <Input
                      id="total-days"
                      type="number"
                      value={formData.workingdays}
                      readOnly
                      className="bg-gray-50"
                    />
                  </div>
                </div>
                {formData.validationErrors.duration && (
                  <div className="text-red-500 text-sm mt-1">
                    {formData.validationErrors.duration}
                  </div>
                )}

                {/* Leave calculation component */}
                {formData.startDate && formData.endDate && (
                  <LeaveCalculation
                    startDate={formData.startDate}
                    endDate={formData.endDate}
                    holidays={holidays}
                    onCalculate={handleLeaveCalculation}
                  />
                )}
              </div>
            </div>

            {/* Group V: Leave Balance Calculation */}
            <div className="border rounded-md overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 font-medium">V. CATATAN CUTI</div>
              <div className="p-4">
                {/* Input pemakaian saldo per tahun */}
                {formData.leaveType === "Cuti Tahunan" && mode === "create" && (
                  <div className="mb-4">
                    <div className="font-medium mb-2">Penggunaan Saldo Cuti per Tahun</div>

                    {/* Pilihan saldo otomatis */}
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <div className="text-sm font-medium text-blue-800 mb-2">
                        Pilihan Saldo Otomatis:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant={
                            formData.selectedLeaveBalance === "twoYearsAgo"
                              ? "default"
                              : "outline"
                          }
                          size="sm"
                          onClick={() => handleSelectedLeaveBalanceChange("twoYearsAgo")}
                          disabled={remainingTwoYearsAgoBalance <= 0}
                        >
                          Saldo N-2 ({twoYearsAgoBalance} hari) - Tersisa: {remainingTwoYearsAgoBalance} hari
                        </Button>
                        <Button
                          type="button"
                          variant={
                            formData.selectedLeaveBalance === "carryOver"
                              ? "default"
                              : "outline"
                          }
                          size="sm"
                          onClick={() => handleSelectedLeaveBalanceChange("carryOver")}
                          disabled={remainingCarryOverBalance <= 0}
                        >
                          Saldo N-1 ({carryOverBalance} hari) - Tersisa: {remainingCarryOverBalance} hari
                        </Button>
                        <Button
                          type="button"
                          variant={
                            formData.selectedLeaveBalance === "current" ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() => handleSelectedLeaveBalanceChange("current")}
                          disabled={remainingCurrentYearBalance <= 0}
                        >
                          Saldo Tahun Ini ({initialBalance} hari) - Tersisa: {remainingCurrentYearBalance} hari
                        </Button>
                      </div>
                      <div className="text-xs text-blue-600 mt-2">
                        Pilih salah satu untuk mengisi otomatis, atau isi manual di tabel di bawah ini.
                        Angka dalam kurung adalah saldo tersedia, "Tersisa" adalah saldo yang masih bisa digunakan.
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm border rounded-md">
                        <thead>
                          <tr className="bg-gray-100 dark:bg-gray-800">
                            <th className="px-2 py-1 border">Tahun</th>
                            <th className="px-2 py-1 border">Saldo Tersedia</th>
                            <th className="px-2 py-1 border">Pakai Saldo</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="px-2 py-1 border font-medium">
                              {new Date().getFullYear() - 2}
                            </td>
                            <td className="px-2 py-1 border">
                              {twoYearsAgoBalance} hari
                            </td>
                            <td className="px-2 py-1 border">
                              <Input
                                type="number"
                                min={0}
                                max={remainingTwoYearsAgoBalance}
                                value={formData.usedTwoYearsAgo}
                                onChange={(e) =>
                                  handleLeaveUsageChange(
                                    "usedTwoYearsAgo",
                                    Number(e.target.value)
                                  )
                                }
                                className="w-24"
                                disabled={mode !== "create"}
                              />
                            </td>
                          </tr>
                          <tr>
                            <td className="px-2 py-1 border font-medium">
                              {new Date().getFullYear() - 1}
                            </td>
                            <td className="px-2 py-1 border">
                              {carryOverBalance} hari
                            </td>
                            <td className="px-2 py-1 border">
                              <Input
                                type="number"
                                min={0}
                                max={remainingCarryOverBalance}
                                value={formData.usedPrevYear}
                                onChange={(e) =>
                                  handleLeaveUsageChange(
                                    "usedPrevYear",
                                    Number(e.target.value)
                                  )
                                }
                                className="w-24"
                                disabled={mode !== "create"}
                              />
                            </td>
                          </tr>
                          <tr>
                            <td className="px-2 py-1 border font-medium">
                              {new Date().getFullYear()}
                            </td>
                            <td className="px-2 py-1 border">
                              {initialBalance} hari
                            </td>
                            <td className="px-2 py-1 border">
                              <Input
                                type="number"
                                min={0}
                                max={remainingCurrentYearBalance}
                                value={formData.usedCurrentYear}
                                onChange={(e) =>
                                  handleLeaveUsageChange(
                                    "usedCurrentYear",
                                    Number(e.target.value)
                                  )
                                }
                                className="w-24"
                                disabled={mode !== "create"}
                              />
                            </td>
                          </tr>
                          <tr className="bg-gray-50">
                            <td className="px-2 py-1 border font-medium">Total</td>
                            <td className="px-2 py-1 border font-medium">
                              {twoYearsAgoBalance +
                                carryOverBalance +
                                initialBalance}{" "}
                              hari
                            </td>
                            <td className="px-2 py-1 border font-medium">
                              <span
                                className={cn(
                                  "px-2 py-1 rounded text-xs",
                                  formData.usedTwoYearsAgo +
                                    formData.usedPrevYear +
                                    formData.usedCurrentYear ===
                                    formData.workingdays
                                    ? "bg-green-100 text-green-800"
                                    : formData.usedTwoYearsAgo +
                                        formData.usedPrevYear +
                                        formData.usedCurrentYear >
                                      formData.workingdays
                                    ? "bg-red-100 text-red-800"
                                    : "bg-yellow-100 text-yellow-800"
                                )}
                              >
                                {formData.usedTwoYearsAgo +
                                  formData.usedPrevYear +
                                  formData.usedCurrentYear}{" "}
                                / {formData.workingdays} hari
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    {/* Informasi saldo tersisa */}
                    <div className="mt-3 p-3 bg-gray-50 border rounded-md">
                      <div className="text-sm font-medium text-gray-700 mb-2">Informasi Saldo Tersisa:</div>
                      <div className="grid grid-cols-3 gap-4 text-xs">
                        <div>
                          <span className="font-medium">Tahun N-2:</span> {remainingTwoYearsAgoBalance} hari tersisa
                        </div>
                        <div>
                          <span className="font-medium">Tahun N-1:</span> {remainingCarryOverBalance} hari tersisa
                        </div>
                        <div>
                          <span className="font-medium">Tahun Ini:</span> {remainingCurrentYearBalance} hari tersisa
                        </div>
                      </div>
                    </div>
                    {/* Validasi */}
                    {(() => {
                      const errors = validateLeaveUsage(
                        formData.usedTwoYearsAgo,
                        formData.usedPrevYear,
                        formData.usedCurrentYear
                      );
                      return errors.length > 0 ? (
                        <div className="mt-2 text-red-600 text-xs space-y-1">
                          {errors.map((err: string, idx: number) => (
                            <div key={idx}>{err}</div>
                          ))}
                        </div>
                      ) : null;
                    })()}
                  </div>
                )}
                {/* Komponen info saldo cuti */}
                <LeaveBalanceInfo
                  workingDays={formData.workingdays}
                  leaveType={formData.leaveType}
                  userId={user?.id}
                  mode={mode}
                  selectedLeaveBalance={
                    formData.selectedLeaveBalance as "current" | "twoYearsAgo" | "carryOver"
                  }
                  usedTwoYearsAgo={formData.usedTwoYearsAgo}
                  usedPrevYear={formData.usedPrevYear}
                  usedCurrentYear={formData.usedCurrentYear}
                />
              </div>
            </div>

            {/* Group VI: Address During Leave */}
            <div className="border rounded-md overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 font-medium">
                VI. ALAMAT SELAMA MENJALANKAN CUTI
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="address">Alamat</Label>
                    <Textarea
                      id="address"
                      value={formData.address}
                      onChange={(e) => handleChange("address", e.target.value)}
                      placeholder="Masukkan alamat selama cuti"
                      rows={2}
                      readOnly={mode !== "create"}
                      className={mode !== "create" ? "bg-gray-50" : ""}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Telepon</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => handleChange("phone", e.target.value)}
                      placeholder="Nomor telepon"
                      readOnly={mode !== "create"}
                      className={mode !== "create" ? "bg-gray-50" : ""}
                    />
                  </div>
                </div>

                <div className="flex flex-col items-center pt-4">
                  <p className="text-sm text-center">Hormat Saya,</p>
                  <div className="my-2 px-4 py-2 bg-green-100 text-green-800 rounded-md font-medium">
                    TERTANDA
                  </div>
                  <p className="font-medium">{formData.name}</p>
                  <p className="text-sm">NIP. {formData.nip}</p>
                </div>
              </div>
            </div>

            {/* Group VII: Supervisor Approval */}
            <div className="border rounded-md overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 font-medium">
                VII. PERTIMBANGAN ATASAN LANGSUNG
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div
                    className={cn(
                      "border p-2 rounded-md",
                      formData.supervisorSigned &&
                        requestData?.supervisor_status === "Approved"
                        ? "bg-green-100 border-green-500"
                        : ""
                    )}
                  >
                    DISETUJUI
                  </div>
                  <div className="border p-2 rounded-md">PERUBAHAN</div>
                  <div className="border p-2 rounded-md">DITANGGUHKAN</div>
                  <div
                    className={cn(
                      "border p-2 rounded-md",
                      formData.supervisorSigned &&
                        requestData?.supervisor_status === "Rejected"
                        ? "bg-red-100 border-red-500"
                        : ""
                    )}
                  >
                    TIDAK DISETUJUI
                  </div>
                </div>

                {mode === "create" && (
                  <div className="pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="supervisor-nip">NIP Atasan</Label>
                        <div className="flex space-x-2">
                          <Input
                            id="supervisor-nip"
                            value={formData.supervisorNIP}
                            onChange={(e) => handleSupervisorNIPInput(e.target.value)}
                            placeholder="Masukkan NIP atasan"
                          />
                          <Button
                            variant="outline"
                            onClick={() => setIsSupervisorDialogOpen(true)}
                            className="whitespace-nowrap"
                          >
                            <Search className="h-4 w-4 mr-1" />
                            Cari
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="supervisor-name">Nama Atasan</Label>
                        <Input
                          id="supervisor-name"
                          value={formData.supervisorName || ""}
                          readOnly
                          className="bg-gray-50"
                        />
                      </div>
                    </div>
                    <div className="mt-4">
                      <Label htmlFor="supervisor-position">Jabatan Atasan</Label>
                      <Input
                        id="supervisor-position"
                        value={formData.supervisorPosition || ""}
                        readOnly
                        className="bg-gray-50"
                      />
                    </div>
                  </div>
                )}

                {mode === "approve" && approverType === "supervisor" && (
                  <div className="flex flex-col items-center pt-4">
                    <Button
                      type="button"
                      onClick={toggleSupervisorSignature}
                      variant={formData.supervisorSigned ? "default" : "outline"}
                      className="my-2"
                    >
                      {formData.supervisorSigned ? "TERTANDA" : "Tanda Tangan"}
                    </Button>
                    <p className="font-medium">{formData.supervisorName}</p>
                    <p className="text-sm">NIP. {formData.supervisorNIP || "-"}</p>
                    {formData.supervisorSignatureDate && (
                      <p className="text-xs text-gray-500 mt-1">
                        Ditandatangani pada:{" "}
                        {format(
                          new Date(formData.supervisorSignatureDate),
                          "dd MMM yyyy HH:mm"
                        )}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Group VIII: Authorized Officer Approval */}
            <div className="border rounded-md overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 font-medium">
                VIII. KEPUTUSAN PEJABAT YANG BERWENANG MEMBERIKAN CUTI
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div
                    className={cn(
                      "border p-2 rounded-md",
                      formData.authorizedOfficerSigned &&
                        requestData?.authorized_officer_status === "Approved"
                        ? "bg-green-100 border-green-500"
                        : ""
                    )}
                  >
                    DISETUJUI
                  </div>
                  <div className="border p-2 rounded-md">PERUBAHAN</div>
                  <div className="border p-2 rounded-md">DITANGGUHKAN</div>
                  <div
                    className={cn(
                      "border p-2 rounded-md",
                      formData.authorizedOfficerSigned &&
                        requestData?.authorized_officer_status === "Rejected"
                        ? "bg-red-100 border-red-500"
                        : ""
                    )}
                  >
                    TIDAK DISETUJUI
                  </div>
                </div>

                {mode === "create" && (
                  <div className="pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="authorized-officer-nip">NIP Pejabat Berwenang</Label>
                        <div className="flex space-x-2">
                          <Input
                            id="authorized-officer-nip"
                            value={formData.authorizedOfficerNIP}
                            onChange={(e) => handleAuthorizedOfficerNIPInput(e.target.value)}
                            placeholder="Masukkan NIP pejabat berwenang"
                          />
                          <Button
                            variant="outline"
                            onClick={() => setIsAuthorizedOfficerDialogOpen(true)}
                            className="whitespace-nowrap"
                          >
                            <Search className="h-4 w-4 mr-1" />
                            Cari
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="authorized-officer-name">Nama Pejabat</Label>
                        <Input
                          id="authorized-officer-name"
                          value={formData.authorizedOfficerName}
                          readOnly
                          className="bg-gray-50"
                        />
                      </div>
                    </div>
                    <div className="mt-4">
                      <Label htmlFor="authorized-officer-position">Jabatan Pejabat</Label>
                      <Input
                        id="authorized-officer-position"
                        value={formData.authorizedOfficerPosition}
                        readOnly
                        className="bg-gray-50"
                      />
                    </div>
                  </div>
                )}

                {mode === "approve" && approverType === "authorized_officer" && (
                  <div className="flex flex-col items-center pt-4">
                    <Button
                      type="button"
                      onClick={toggleAuthorizedOfficerSignature}
                      variant={formData.authorizedOfficerSigned ? "default" : "outline"}
                      className="my-2"
                    >
                      {formData.authorizedOfficerSigned
                        ? "TERTANDA"
                        : "Tanda Tangan"}
                    </Button>
                    <p className="font-medium">
                      {formData.authorizedOfficerName || "Pilih Pejabat Berwenang"}
                    </p>
                    <p className="text-sm">NIP. {formData.authorizedOfficerNIP || "-"}</p>
                    {formData.authorizedOfficerSignatureDate && (
                      <p className="text-xs text-gray-500 mt-1">
                        Ditandatangani pada:{" "}
                        {format(
                          new Date(formData.authorizedOfficerSignatureDate),
                          "dd MMM yyyy HH:mm"
                        )}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Rejection Reason Form */}
            {showRejectionForm && (
              <div className="border rounded-md p-4 space-y-4 bg-red-50 border-red-200">
                <h3 className="font-medium text-red-700">Alasan Penolakan</h3>
                <Textarea
                  value={formData.rejectionReason}
                  onChange={(e) => handleChange("rejectionReason", e.target.value)}
                  placeholder="Masukkan alasan penolakan permintaan cuti"
                  rows={3}
                />
              </div>
            )}

            {/* Submit Buttons */}
            <div className="flex justify-end space-x-4 mt-6">
              {mode === "create" && (
                <>
                  <Button type="button" variant="outline" onClick={onClose}>
                    Batal
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      handleSubmit(new Event("submit") as any);
                    }}
                    disabled={
                      !formData.supervisorId ||
                      !formData.authorizedOfficerId ||
                      !formData.startDate ||
                      !formData.endDate ||
                      !formData.leaveReason ||
                      !formData.address ||
                      !formData.phone ||
                      (formData.leaveType === "Cuti Tahunan" &&
                        (formData.workingdays > remainingBalance ||
                          formData.workingdays <= 0)) ||
                      // Nonaktifkan tombol jika ada error validasi durasi cuti
                      !!formData.validationErrors.duration
                    }
                  >
                    Ajukan
                  </Button>
                </>
              )}

              {mode === "approve" && effectiveApproverType === "supervisor" && (
                <>
                  <Button type="button" variant="outline" onClick={onClose}>
                    Tutup
                  </Button>
                  {requestData?.supervisor_status === "Pending" && (
                    <>
                      {showRejectionForm ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowRejectionForm(false)}
                          >
                            Kembali
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={() => handleSupervisorAction("Rejected")}
                            disabled={!formData.supervisorSigned}
                          >
                            Konfirmasi Penolakan
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={() => setShowRejectionForm(true)}
                            disabled={!formData.supervisorSigned}
                          >
                            <X className="mr-2 h-4 w-4" />
                            Tolak
                          </Button>
                          <Button
                            type="button"
                            onClick={() => handleSupervisorAction("Approved")}
                            disabled={!formData.supervisorSigned}
                          >
                            <Check className="mr-2 h-4 w-4" />
                            Setujui
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </>
              )}

              {mode === "approve" && effectiveApproverType === "authorized_officer" && (
                <>
                  <Button type="button" variant="outline" onClick={onClose}>
                    Tutup
                  </Button>
                  {requestData?.authorized_officer_status === "Pending" && (
                    <>
                      {showRejectionForm ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowRejectionForm(false)}
                          >
                            Kembali
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={() => handleAuthorizedOfficerAction("Rejected")}
                            disabled={!formData.authorizedOfficerSigned}
                          >
                            Konfirmasi Penolakan
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={() => setShowRejectionForm(true)}
                            disabled={!formData.authorizedOfficerSigned}
                          >
                            <X className="mr-2 h-4 w-4" />
                            Tolak
                          </Button>
                          <Button
                            type="button"
                            onClick={() => handleAuthorizedOfficerAction("Approved")}
                            disabled={!formData.authorizedOfficerSigned}
                          >
                            <Check className="mr-2 h-4 w-4" />
                            Setujui
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </>
              )}

              {mode === "view" && (
                <Button type="button" variant="outline" onClick={onClose}>
                  Tutup
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Supervisor Search Dialog */}
      <SearchDialog
        isOpen={isSupervisorDialogOpen}
        onOpenChange={(open) => {
          if (!open && formData.supervisorId) {
            console.log(
              "Supervisor dialog closed, preserving selected supervisor:",
              formData.supervisorId
            );
          }
          setIsSupervisorDialogOpen(open);
        }}
        title="Cari Atasan Langsung"
        description="Cari dan pilih Atasan Langsung berdasarkan nama, NIP, atau jabatan."
        items={potentialSupervisors}
        selectedId={formData.supervisorId || null}
        onSelect={handleSupervisorSelect}
      />

      {/* Authorized Officer Search Dialog */}
      <SearchDialog
        isOpen={isAuthorizedOfficerDialogOpen}
        onOpenChange={(open) => {
          if (!open && formData.authorizedOfficerId) {
            console.log(
              "Authorized officer dialog closed, preserving selected officer:",
              formData.authorizedOfficerId
            );
          }
          setIsAuthorizedOfficerDialogOpen(open);
        }}
        title="Cari Pejabat Berwenang"
        description="Cari dan pilih pejabat berwenang berdasarkan nama, NIP, atau jabatan."
        items={potentialAuthorizedOfficers}
        selectedId={formData.authorizedOfficerId || null}
        onSelect={handleAuthorizedOfficerSelect}
      />
    </>
  );
}
