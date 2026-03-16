import React from "react";

type NextoolyToolPageShellProps = {
  title: string;
  description: string;
  tool: React.ReactNode;
  belowTool?: React.ReactNode;
  schema?: React.ReactNode;
};

export default function NextoolyToolPageShell({
  title,
  description,
  tool,
  belowTool,
  schema,
}: NextoolyToolPageShellProps) {
  return (
    <main className="min-h-screen bg-white">
      {schema ?? null}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 1. Page Header (Left Aligned) */}
        <div className="text-left border-b border-gray-200 pb-2 mb-8">
          <h1 className="text-[26px] font-bold text-[#0f172a] mb-[6px] leading-tight">
            {title}
          </h1>
          <p className="text-[15px] text-[#475569] mb-[16px] leading-relaxed">
            {description}
          </p>
        </div>

        {/* 2. Tool */}
        <div className="mb-16">{tool}</div>

        {/* 3. Sections */}
        {belowTool ?? null}
      </div>
    </main>
  );
}
