import PdfCompressorTool from "@/components/tools/PdfCompressorTool";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Compress PDF Online</h1>
          <p className="mt-2 text-gray-600">
            Reduce PDF file size directly in your browser. No uploads. Fast, private, and secure.
          </p>
        </header>

        <PdfCompressorTool />

        <p className="mt-8 text-center text-sm text-gray-400">Powered by Nextooly</p>
      </div>
    </main>
  );
}
