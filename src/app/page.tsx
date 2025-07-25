import Link from "next/link";

export default function UppyDashboard() {
  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <Link
        href="/upload"
        className="flex items-center justify-center border border-gray-300 rounded-md p-4"
      >
        Upload
      </Link>
    </div>
  );
}
