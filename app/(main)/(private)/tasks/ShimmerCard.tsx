import React from 'react'

const ShimmerCard = () => {
  return (
    <div className="animate-pulse flex flex-col justify-between bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
      <div className="bg-gray-300 w-full h-48" />
      <div className="p-4 space-y-3">
        <div className="h-5 bg-gray-300 rounded w-2/3" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-10 bg-gray-300 rounded w-full mt-4" />
      </div>
    </div>
  );
}

export default ShimmerCard
