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
import { Check, Calendar, Lock, Search, X } from "lucide-react";
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
  used_carry_over_days?: number;
  used_current_year_days?: number;
  saldo_carry: number;
  saldo_current_year: number;
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
  const { holidays, users, user, leaveRequests, calculateRemainingLeaveBalance } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: user?.name || "",
    nip: user?.id?.toString() || "",
    position: user?.position || "",
    workUnit: "Subbag. Tata Usaha Kankemenag Kota Tanjungpinang",
    yearsOfService: "2 tahun",
    leaveType: "Cuti Tahunan",
    leaveReason: "",
    startDate: "",
    endDate: "",
    totalDays: 0,
    workingdays: 0,
    address: "",
    phone: "",
    rejectionReason: "",

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
  });

  const [holidaysInRange, setHolidaysInRange] = useState<any[]>([]);
  const [weekendsInRange, setWeekendsInRange] = useState<Date[]>([]);
  const [initialBalance, setInitialBalance] = useState(12);
  const [remainingBalance, setRemainingBalance] = useState(12);
  const [carryOverBalance, setCarryOverBalance] = useState(0);
  const [remainingCarryOverBalance, setRemainingCarryOverBalance] = useState(0);
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
          initialBalance: 12,
          carryOverBalance: 0,
          remainingCarryOverBalance: 0,
          remainingCurrentYearBalance: 0,
          remainingBalance: 12,
        };

      // Dapatkan user
      const targetUser = users.find((u) => u.id === userId);
      if (!targetUser || !targetUser.leave_balance) {
        return {
          initialBalance: 12,
          carryOverBalance: 0,
          remainingCarryOverBalance: 0,
          remainingCurrentYearBalance: 0,
          remainingBalance: 12,
        };
      }

      const currentYear = new Date().getFullYear();
      const previousYear = currentYear - 1;

      // Ambil saldo dari leave_balance
      const currentYearBalance = targetUser.leave_balance[currentYear.toString()] || 0;
      const previousYearBalance = targetUser.leave_balance[previousYear.toString()] || 0;

      // Penggunaan cuti tetap dihitung dari leaveRequests
      const usedLeave = leaveRequests
        .filter(
          (req) =>
            req.user_id === userId &&
            req.status === "Approved" &&
            String(new Date(req.start_date).getFullYear()) === currentYear.toString()
        )
        .reduce((total, req) => total + (req.workingdays || 0), 0);

      const usedCarryOver = leaveRequests
        .filter(
          (req) =>
            req.user_id === userId &&
            req.status === "Approved" &&
            req.leave_year === currentYear
        )
        .reduce((total, req) => total + (req.used_carry_over_days || 0), 0);

      const usedCurrentYear = leaveRequests
        .filter(
          (req) =>
            req.user_id === userId &&
            req.status === "Approved" &&
            req.leave_year === currentYear
        )
        .reduce((total, req) => total + (req.used_current_year_days || 0), 0);

      // Hitung sisa saldo
      const remainingCarryOver = Math.max(0, previousYearBalance - usedCarryOver);
      const remainingCurrentYear = Math.max(0, currentYearBalance - usedCurrentYear);
      const remainingTotal = remainingCarryOver + remainingCurrentYear;

      return {
        initialBalance: currentYearBalance,
        carryOverBalance: previousYearBalance,
        remainingCarryOverBalance: remainingCarryOver,
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
    if (!isOpen) return;

    if (mode === "create" && user) {
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

        return {
          ...prev,
          name: user.name || "",
          nip: user.id?.toString() || "",
          position: user.position || "",
          workUnit: user.workunit || "Subbag. Tata Usaha Kankemenag Kota Tanjungpinang",
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
          setRemainingBalance(balances.remainingBalance);
          setRemainingCarryOverBalance(balances.remainingCarryOverBalance);
          setRemainingCurrentYearBalance(balances.remainingCurrentYearBalance);
        }
      }
    } else if ((mode === "view" || mode === "approve") && requestData) {
      console.log("Initializing form data for view/approve mode.");
      // For viewing or approving existing requests, load data from requestData
      const requester = users.find((u) => u.id === requestData.user_id);
      const supervisor = users.find((u) => u.id === requestData.supervisor_id);
      const authorizedOfficer = users.find((u) => u.id === requestData.authorized_officer_id);

      setFormData((prev) => ({
        ...prev,
        name: requester?.name || "",
        nip: requester?.id?.toString() || "",
        position: requester?.position || "",
        workUnit: requester?.workunit || "Subbag. Tata Usaha Kankemenag Kota Tanjungpinang",
        yearsOfService: "2 tahun",
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
        supervisorNIP: supervisor?.id?.toString() || "",
        supervisorSigned: prev.supervisorSigned || requestData.supervisor_signed || false,
        supervisorSignatureDate:
          prev.supervisorSignatureDate || requestData.supervisor_signature_date || "",

        authorizedOfficerId: requestData.authorized_officer_id,
        authorizedOfficerName: authorizedOfficer?.name || "",
        authorizedOfficerPosition: authorizedOfficer?.position || "",
        authorizedOfficerNIP: authorizedOfficer?.id?.toString() || "",
        authorizedOfficerSigned:
          prev.authorizedOfficerSigned || requestData.authorized_officer_signed || false,
        authorizedOfficerSignatureDate:
          prev.authorizedOfficerSignatureDate ||
          requestData.authorized_officer_signature_date ||
          "",
      }));

      // Check if current user is the assigned supervisor
      if (user && approverType === "supervisor" && user.id === requestData.supervisor_id) {
        setIsValidSupervisor(true);
        setSupervisorNIPInput(user.id.toString());
      }

      // Check if current user is the authorized officer
      if (
        user &&
        approverType === "authorized_officer" &&
        user.id === requestData.authorized_officer_id
      ) {
        setIsValidAuthorizedOfficer(true);
        setAuthorizedOfficerNIPInput(user.id.toString());
      }

      // Calculate leave balances for the requester
      if (requester && requester.id) {
        const balances = calculateLeaveBalances(requester.id);
        if (typeof balances !== "number") {
          setInitialBalance(balances.initialBalance);
          setCarryOverBalance(balances.carryOverBalance);
          setRemainingBalance(balances.remainingBalance);
          setRemainingCarryOverBalance(balances.remainingCarryOverBalance);
          setRemainingCurrentYearBalance(balances.remainingCurrentYearBalance);
        }
      }
    }
  }, [open, mode, user, requestData, approverType, users, calculateLeaveBalances]);

  useEffect(() => {
    console.log("Form data updated:", formData);
  }, [formData]);

  // Handle form field changes
  const handleChange = (field: string, value: any) => {
    console.log(`Changing field ${field} to`, value);
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
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
  };

  // Toggle supervisor signature
  const toggleSupervisorSignature = useCallback(() => {
    if (!isValidSupervisor || mode !== "approve" || approverType !== "supervisor") {
      toast({
        title: "Validasi diperlukan",
        description: "Anda harus memvalidasi identitas Anda terlebih dahulu",
        variant: "destructive",
      });
      return;
    }

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
  }, [isValidSupervisor, mode, approverType, toast]);

  // Toggle authorized officer signature
  const toggleAuthorizedOfficerSignature = () => {
    console.log("toggleAuthorizedOfficerSignature called");
    console.log("Current conditions:", {
      isValidAuthorizedOfficer,
      mode,
      approverType,
      currentSignedState: formData.authorizedOfficerSigned,
    });

    if (
      isValidAuthorizedOfficer &&
      mode === "approve" &&
      approverType === "authorized_officer"
    ) {
      const now = new Date().toISOString();
      const newSignedState = !formData.authorizedOfficerSigned;

      console.log("Updating authorized officer signature to:", newSignedState);

      setFormData((prev) => {
        const newState = {
          ...prev,
          authorizedOfficerSigned: newSignedState,
          authorizedOfficerSignatureDate: newSignedState ? now : "",
        };
        console.log("New form state:", newState);
        return newState;
      });

      toast({
        title: newSignedState ? "Dokumen ditandatangani" : "Tanda tangan dibatalkan",
        description: newSignedState
          ? "Dokumen telah berhasil ditandatangani"
          : "Tanda tangan Anda telah dibatalkan",
      });
    } else {
      console.log("Validation failed:", {
        isValidAuthorizedOfficer,
        mode,
        approverType,
      });

      toast({
        title: "Validasi diperlukan",
        description: "Masukkan NIP Anda untuk memvalidasi identitas",
        variant: "destructive",
      });
    }
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

  // Validate supervisor NIP
  const validateSupervisorNIP = () => {
    console.log("Validating supervisor NIP.");
    // Check if the entered NIP matches the assigned supervisor
    if (
      supervisorNIPInput &&
      formData.supervisorId &&
      supervisorNIPInput === formData.supervisorId.toString() &&
      user?.id.toString() === supervisorNIPInput
    ) {
      setIsValidSupervisor(true);
      toast({
        title: "Identitas tervalidasi",
        description: "Anda dapat menandatangani dokumen ini",
      });
    } else {
      setIsValidSupervisor(false);
      toast({
        title: "Validasi gagal",
        description: "NIP tidak valid atau Anda bukan penandatangan yang ditunjuk",
        variant: "destructive",
      });
    }
  };

  // Validate authorized officer NIP
  const validateAuthorizedOfficerNIP = () => {
    console.log("Validating authorized officer NIP.");
    // Check if the entered NIP matches the authorized officer
    if (
      authorizedOfficerNIPInput &&
      formData.authorizedOfficerId &&
      authorizedOfficerNIPInput === formData.authorizedOfficerId.toString() &&
      user?.id.toString() === authorizedOfficerNIPInput
    ) {
      setIsValidAuthorizedOfficer(true);
      toast({
        title: "Identitas tervalidasi",
        description: "Anda dapat menandatangani dokumen ini",
      });
    } else {
      setIsValidAuthorizedOfficer(false);
      toast({
        title: "Validasi gagal",
        description: "NIP tidak valid atau Anda bukan pejabat yang berwenang",
        variant: "destructive",
      });
    }
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
        authorized_officer_viewed: false,
        supervisor_signed: false,
        authorized_officer_signed: false,
        supervisor_signature_date: null,
        authorized_officer_signature_date: null,
        rejection_reason: null,
        leave_year: new Date(formData.startDate).getFullYear(),
        saldo_carry: carryOverBalance,
        saldo_current_year: initialBalance,
      };

      // Hitung penggunaan saldo cuti
      if (formData.leaveType === "Cuti Tahunan") {
        const currentYear = new Date(formData.startDate).getFullYear();
        const previousYear = currentYear - 1;

        // Ambil data user untuk mendapatkan saldo cuti
        const targetUser = users.find((u) => u.id === user.id);
        if (!targetUser || !targetUser.leave_balance) {
          throw new Error("Data saldo cuti tidak tersedia");
        }

        const previousYearBalance = targetUser.leave_balance[previousYear.toString()] || 0;
        let usedCarryOver = 0;
        let usedCurrentYear = 0;

        if (workingDays > 0) {
          // Jika ada saldo tahun lalu, gunakan itu dulu
          if (previousYearBalance > 0) {
            usedCarryOver = Math.min(previousYearBalance, workingDays);
            usedCurrentYear = Math.max(0, workingDays - usedCarryOver);
          } else {
            // Jika tidak ada saldo tahun lalu, gunakan saldo tahun ini
            usedCurrentYear = workingDays;
          }
        }

        // Tambahkan data penggunaan saldo ke submissionData
        submissionData.used_carry_over_days = usedCarryOver;
        submissionData.used_current_year_days = usedCurrentYear;

        console.log("Detail penggunaan saldo:", {
          workingDays,
          previousYearBalance,
          usedCarryOver,
          usedCurrentYear
        });
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
      onClose();
    } catch (err) {
      console.error("Error submitting leave request:", err);
      toast({
        title: "Gagal mengirim permintaan",
        description: err instanceof Error ? err.message : "Gagal mengirim permintaan cuti",
        variant: "destructive",
      });
      setError(err instanceof Error ? err.message : "Gagal mengirim permintaan cuti");
    } finally {
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
    if (!isValidAuthorizedOfficer) {
      toast({
        title: "Validasi diperlukan",
        description: "Anda harus memvalidasi identitas Anda terlebih dahulu",
        variant: "destructive",
      });
      return;
    }

    // Hanya cek tanda tangan jika status Approved
    if (status === "Approved" && !formData.authorizedOfficerSigned) {
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
      signatureDate: status === "Approved" ? formData.authorizedOfficerSignatureDate : undefined,
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
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Cuti Besar" id="leave-type-2" />
                    <Label htmlFor="leave-type-2">Cuti Besar</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Cuti Sakit" id="leave-type-3" />
                    <Label htmlFor="leave-type-3">Cuti Sakit</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Cuti Melahirkan" id="leave-type-4" />
                    <Label htmlFor="leave-type-4">Cuti Melahirkan</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Cuti Karena Alasan Penting" id="leave-type-5" />
                    <Label htmlFor="leave-type-5">Cuti Karena Alasan Penting</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Cuti di Luar Tanggungan Negara" id="leave-type-6" />
                    <Label htmlFor="leave-type-6">Cuti di Luar Tanggungan Negara</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

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
                <LeaveBalanceInfo
                  workingDays={formData.workingdays}
                  leaveType={formData.leaveType}
                  userId={user?.id}
                  mode={mode}
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
                  <div className="pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="supervisor-nip">Validasi NIP Atasan</Label>
                        <div className="flex space-x-2">
                          <Input
                            id="supervisor-nip"
                            value={supervisorNIPInput}
                            onChange={(e) => setSupervisorNIPInput(e.target.value)}
                            placeholder="Masukkan NIP Anda untuk validasi"
                            disabled={isValidSupervisor}
                          />
                          <Button
                            variant="outline"
                            onClick={validateSupervisorNIP}
                            disabled={isValidSupervisor}
                          >
                            Validasi
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label>Status Validasi</Label>
                        <div
                          className={cn(
                            "mt-2 px-3 py-1 rounded-md flex items-center",
                            isValidSupervisor
                              ? "bg-green-100 text-green-800"
                              : "bg-yellow-100 text-yellow-800"
                          )}
                        >
                          {isValidSupervisor ? (
                            <>
                              <Check className="h-4 w-4 mr-2" />
                              Tervalidasi
                            </>
                          ) : (
                            <>
                              <Lock className="h-4 w-4 mr-2" />
                              Belum Tervalidasi
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col items-center pt-4">
                  {mode === "create" ? (
                    <div className="my-2 px-4 py-2 bg-gray-100 text-gray-800 rounded-md font-medium">
                      {"{Belum Ditandatangani}"}
                    </div>
                  ) : mode === "approve" && approverType === "supervisor" ? (
                    <Button
                      type="button"
                      onClick={() => {
                        console.log("Supervisor sign button clicked");
                        console.log("isValidSupervisor:", isValidSupervisor);
                        console.log("mode:", mode);
                        console.log("approverType:", approverType);
                        toggleSupervisorSignature();
                      }}
                      variant={formData.supervisorSigned ? "default" : "outline"}
                      disabled={!isValidSupervisor}
                      className="my-2"
                    >
                      {formData.supervisorSigned ? "TERTANDA" : "Tanda Tangan Di Atas Nama"}
                    </Button>
                  ) : (
                    <div
                      className={cn(
                        "my-2 px-4 py-2 rounded-md font-medium",
                        formData.supervisorSigned
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      )}
                    >
                      {formData.supervisorSigned ? "TERTANDA" : "{Belum Ditandatangani}"}
                    </div>
                  )}
                  <p className="font-medium">{formData.supervisorName}</p>
                  <p className="text-sm">NIP. {formData.supervisorNIP || "-"}</p>
                  {formData.supervisorSignatureDate && (
                    <p className="text-xs text-gray-500 mt-1">
                      Ditandatangani pada:{" "}
                      {format(new Date(formData.supervisorSignatureDate), "dd MMM yyyy HH:mm")}
                    </p>
                  )}
                </div>
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
                  <div className="pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="authorized-officer-nip">Validasi NIP Pejabat</Label>
                        <div className="flex space-x-2">
                          <Input
                            id="authorized-officer-nip"
                            value={authorizedOfficerNIPInput}
                            onChange={(e) => setAuthorizedOfficerNIPInput(e.target.value)}
                            placeholder="Masukkan NIP Anda untuk validasi"
                            disabled={isValidAuthorizedOfficer}
                          />
                          <Button
                            variant="outline"
                            onClick={validateAuthorizedOfficerNIP}
                            disabled={isValidAuthorizedOfficer}
                          >
                            Validasi
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label>Status Validasi</Label>
                        <div
                          className={cn(
                            "mt-2 px-3 py-1 rounded-md flex items-center",
                            isValidAuthorizedOfficer
                              ? "bg-green-100 text-green-800"
                              : "bg-yellow-100 text-yellow-800"
                          )}
                        >
                          {isValidAuthorizedOfficer ? (
                            <>
                              <Check className="h-4 w-4 mr-2" />
                              Tervalidasi
                            </>
                          ) : (
                            <>
                              <Lock className="h-4 w-4 mr-2" />
                              Belum Tervalidasi
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col items-center pt-4">
                  {mode === "create" ? (
                    <div className="my-2 px-4 py-2 bg-gray-100 text-gray-800 rounded-md font-medium">
                      {"{Belum Ditandatangani}"}
                    </div>
                  ) : mode === "approve" && approverType === "authorized_officer" ? (
                    <Button
                      type="button"
                      onClick={() => {
                        console.log("Authorized officer sign button clicked");
                        console.log("isValidAuthorizedOfficer:", isValidAuthorizedOfficer);
                        console.log("mode:", mode);
                        console.log("approverType:", approverType);
                        toggleAuthorizedOfficerSignature();
                      }}
                      variant={formData.authorizedOfficerSigned ? "default" : "outline"}
                      disabled={!isValidAuthorizedOfficer}
                      className="my-2"
                    >
                      {formData.authorizedOfficerSigned
                        ? "TERTANDA"
                        : "Tanda Tangan Di Atas Nama"}
                    </Button>
                  ) : (
                    <div
                      className={cn(
                        "my-2 px-4 py-2 rounded-md font-medium",
                        formData.authorizedOfficerSigned
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      )}
                    >
                      {formData.authorizedOfficerSigned
                        ? "TERTANDA"
                        : "{Belum Ditandatangani}"}
                    </div>
                  )}
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
                      (formData.leaveType === "Cuti Tahunan" && (
                        formData.workingdays > remainingBalance ||
                        formData.workingdays <= 0
                      ))
                    }
                  >
                    Ajukan
                  </Button>
                </>
              )}

              {mode === "approve" && approverType === "supervisor" && (
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
                            disabled={!isValidSupervisor || !formData.rejectionReason}
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
                            disabled={!isValidSupervisor}
                          >
                            <X className="mr-2 h-4 w-4" />
                            Tolak
                          </Button>
                          <Button
                            type="button"
                            onClick={() => handleSupervisorAction("Approved")}
                            disabled={!isValidSupervisor || !formData.supervisorSigned}
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

              {mode === "approve" && approverType === "authorized_officer" && (
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
                            disabled={!isValidAuthorizedOfficer || !formData.rejectionReason}
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
                            disabled={!isValidAuthorizedOfficer}
                          >
                            <X className="mr-2 h-4 w-4" />
                            Tolak
                          </Button>
                          <Button
                            type="button"
                            onClick={() => handleAuthorizedOfficerAction("Approved")}
                            disabled={!isValidAuthorizedOfficer || !formData.authorizedOfficerSigned}
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
