// Loading Skeleton Component
export const PokemonDetailsSkeleton = () => (
    <>
        <div className="bg-slate-800/50 backdrop-blur-lg rounded-xl shadow-2xl border border-slate-700 animate-pulse">
            <div className="p-4 bg-slate-900/50 border-b border-slate-700">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="h-8 w-32 bg-slate-700/50 rounded"></div>
                        <div className="flex items-center gap-2 mt-2">
                            <div className="h-7 w-20 bg-slate-700/50 rounded-full"></div>
                            <div className="h-7 w-20 bg-slate-700/50 rounded-full"></div>
                        </div>
                    </div>
                    <div className="h-7 w-16 bg-slate-700/50 rounded-full"></div>
                </div>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="h-[70px] bg-slate-700/50 rounded-lg"></div>
                <div className="h-[70px] bg-slate-700/50 rounded-lg"></div>
                <div className="h-[70px] bg-slate-700/50 rounded-lg"></div>
                <div className="h-[70px] bg-slate-700/50 rounded-lg"></div>
            </div>
        </div>
        <div className="bg-slate-800/50 backdrop-blur-lg rounded-xl shadow-2xl border border-slate-700 p-4 animate-pulse">
            <div className="space-y-3 text-xs">
                <div className="h-4 w-full bg-slate-700/50 rounded"></div>
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="grid grid-cols-4 gap-2 items-center">
                        <div className="h-4 w-10 bg-slate-700/50 rounded"></div>
                        <div className="h-5 w-6 bg-slate-700/50 rounded mx-auto"></div>
                        <div className="col-span-2 h-4 bg-slate-700/50 rounded"></div>
                    </div>
                ))}
            </div>
        </div>
        <div className="bg-slate-800/50 backdrop-blur-lg rounded-xl shadow-2xl border border-slate-700 text-xs animate-pulse flex flex-col min-h-0">
            <div className="p-4 border-b border-slate-700/50 flex-shrink-0">
                 <div className="flex items-center gap-2">
                    <div className="h-6 w-16 bg-slate-700/50 rounded-md"></div>
                    <div className="h-5 w-24 bg-slate-700/50 rounded"></div>
                </div>
            </div>
            <div className="relative flex-1 min-h-0">
                <div className="absolute inset-0 p-4 space-y-2">
                     <div className="h-3 w-full bg-slate-700/50 rounded"></div>
                     <div className="h-3 w-5/6 bg-slate-700/50 rounded"></div>
                </div>
            </div>
        </div>
    </>
);
