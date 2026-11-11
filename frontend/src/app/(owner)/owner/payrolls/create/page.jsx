"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link.js";
import { useRouter, useSearchParams } from "next/navigation.js";
import {
  FiArrowLeft,
  FiDollarSign,
  FiLoader,
  FiSearch,
  FiX,
} from "react-icons/fi";

import { useCreatePayroll } from "../../../../features/payrolls/hooks.js";
import {
  useGetEmployee,
  useGetEmployees,
} from "../../../../features/employees/hooks.js";
import notify from "../../../../../lib/notify.js";
import { normalizeApiError } from "../../../../../lib/api/errors.js";
import PayrollForm from "../../../../../components/owner/payroll-form.jsx";
import {
  FOCUS_RING,
  PAYROLL_PATH,
  Tag,
  describePayrollError,
  inputClass,
} from "../../../../../components/owner/payroll-shared.jsx";

/* Pemilih karyawan: cari nama atau email, lalu pilih satu. */
function EmployeePicker({ selected, onSelect, onClear, disabled }) {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setSearch(input.trim()), 300);
    return () => clearTimeout(timer);
  }, [input]);

  const query = useGetEmployees({ search, page: 1 });
  const list = Array.isArray(query.data)
    ? query.data
    : (query.data?.data ?? []);

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-xl border border-second4 bg-second4/5 p-4">
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold text-second">
            {selected.name}
          </p>
          <p className="mt-2 break-all text-xs text-second/60">
            {selected.email}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={disabled}
          aria-label="Ganti karyawan"
          className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-second shadow transition-colors hover:text-second2 disabled:opacity-50 touch-manipulation ${FOCUS_RING}`}
        >
          <FiX size={16} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <FiSearch
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-second/40"
        />
        <input
          type="search"
          aria-label="Cari karyawan"
          autoComplete="off"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Cari nama atau email karyawan…"
          disabled={disabled}
          className={`${inputClass(false)} pl-8`}
        />
      </div>

      {query.isPending ? (
        <p
          role="status"
          className="flex items-center gap-2 text-sm text-second/60"
        >
          <FiLoader
            className="animate-spin motion-reduce:animate-none"
            size={16}
            aria-hidden="true"
          />
          Memuat karyawan…
        </p>
      ) : query.isError ? (
        <p role="alert" className="text-sm text-second2">
          Gagal memuat karyawan. Coba lagi sebentar lagi.
        </p>
      ) : list.length === 0 ? (
        <p className="rounded-xl bg-second/5 p-4 text-sm text-second/60">
          Tidak ada karyawan yang cocok.
        </p>
      ) : (
        <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
          {list.map((employee) => (
            <li key={employee.id}>
              <button
                type="button"
                onClick={() => onSelect(employee)}
                disabled={disabled}
                className={`flex w-full items-center justify-between gap-4 rounded-xl border border-second/30 p-4 text-left transition-colors hover:border-second4 disabled:opacity-50 touch-manipulation ${FOCUS_RING}`}
              >
                <span className="min-w-0">
                  <span className="block break-words text-sm font-semibold text-second">
                    {employee.name}
                  </span>
                  <span className="mt-2 block break-all text-xs text-second/60">
                    {employee.email}
                  </span>
                </span>
                {employee.is_active === false && <Tag>Nonaktif</Tag>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CreateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetId = searchParams.get("employee_id") ?? "";

  const createMutation = useCreatePayroll();
  const [employee, setEmployee] = useState(null);
  const [employeeError, setEmployeeError] = useState("");

  // Kalau dibuka dari halaman karyawan, karyawannya langsung terpilih.
  const presetQuery = useGetEmployee(presetId || undefined);
  useEffect(() => {
    if (presetQuery.data && !employee) setEmployee(presetQuery.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetQuery.data]);

  async function handleSubmit(payload) {
    setEmployeeError("");
    try {
      const slip = await createMutation.mutateAsync(payload);
      notify.success("Slip gaji berhasil dibuat.");
      router.push(`${PAYROLL_PATH}/${slip.id}`);
    } catch (error) {
      if (error?.response?.data?.errors === "EMPLOYEE_NOT_FOUND") {
        setEmployee(null);
        setEmployeeError("Karyawan tidak ditemukan. Pilih karyawan lain.");
      }
      notify.error(describePayrollError(error, normalizeApiError));
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <header className="flex flex-col gap-4">
        <Link
          href={PAYROLL_PATH}
          className={`inline-flex h-8 w-fit items-center gap-2 rounded-full pr-4 text-sm font-medium text-second/60 transition-colors hover:text-second4 touch-manipulation ${FOCUS_RING}`}
        >
          <FiArrowLeft size={16} aria-hidden="true" />
          Kembali ke gaji karyawan
        </Link>

        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
          >
            <FiDollarSign size={16} />
          </div>
          <div className="min-w-0">
            <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
              Buat <span className="text-grad">slip gaji</span>
            </h1>
            <p className="mt-2 text-pretty text-sm text-second/60">
              Pilih karyawan, isi rekening dan penerimaan, lalu tentukan tanggal
              cair.
            </p>
          </div>
        </div>
      </header>

      <PayrollForm
        mode="create"
        employeeId={employee?.id ?? ""}
        employeeName={employee?.name ?? ""}
        employeeError={employeeError}
        employeeField={
          <EmployeePicker
            selected={employee}
            onSelect={(value) => {
              setEmployee(value);
              setEmployeeError("");
            }}
            onClear={() => setEmployee(null)}
            disabled={createMutation.isPending}
          />
        }
        submitting={createMutation.isPending}
        submitLabel="Simpan slip gaji"
        cancelHref={PAYROLL_PATH}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

export default function CreatePayrollPage() {
  return (
    <Suspense fallback={null}>
      <CreateContent />
    </Suspense>
  );
}
