"use client";

import React from "react";

const baseField =
  "w-full min-h-11 rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 text-base text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 md:min-h-0 md:py-2 md:text-sm";

export function Label({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-xs font-medium text-[var(--muted)]"
    >
      {children}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${baseField} ${props.className ?? ""}`} />;
}

export function Textarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>
) {
  return (
    <textarea
      {...props}
      className={`${baseField} min-h-24 resize-y ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${baseField} ${props.className ?? ""}`}>
      {props.children}
    </select>
  );
}

export function FormRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "outline";
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonProps) {
  const variants: Record<string, string> = {
    primary:
      "bg-[var(--brand)] text-white hover:bg-[var(--brand-600)] disabled:opacity-50",
    outline:
      "border border-[var(--border)] bg-white text-[var(--foreground)] hover:bg-black/[0.03]",
    ghost: "text-[var(--muted)] hover:bg-black/[0.05] hover:text-[var(--foreground)]",
    danger: "bg-red-500 text-white hover:bg-red-600 disabled:opacity-50",
  };
  return (
    <button
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed md:min-h-0 md:py-2 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
