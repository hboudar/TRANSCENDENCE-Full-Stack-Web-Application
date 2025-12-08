

"use client";

export default function Loading() {
	return (
		<div className="min-h-full flex items-center justify-center p-4">
			<div className="text-center">
				{}
				<div className="relative flex justify-center items-center">
					<div className=" w-22 p-1 animate-bounce">
						<img
							src="/logo.png"
							alt="Logo"
							className="shadow-md hidden md:block"
							width={200}
							height={200}
						/>
					</div>
					{}
				</div>

				{}
				<h2 className="text-2xl font-bold text-purple-400 mb-6 font-sans animate-pulse">
					Loading...
				</h2>

				{}
			</div>
		</div>
	);
}
