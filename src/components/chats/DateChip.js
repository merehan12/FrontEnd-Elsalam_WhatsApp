import React from "react";

export default function DateChip({ label }) {
  return (
    <div className="my-3 flex items-center justify-center sticky top-2 z-10">
      <span
        className="px-3 py-1 rounded-full text-xs font-medium
        bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-100 shadow-sm"
      >
        {label}
      </span>
    </div>
  );
}
