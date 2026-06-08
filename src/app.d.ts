// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
	const __BUILD_DATE__: string;
	const __BUILD_VERSION__: string;
	const __COMMIT_HASH__: string;
}

export {};
