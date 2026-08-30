export type ComboboxOption = {
	key: string;
	label: string;
	/** Extra lowercase-matched terms (type, category, etc.) beyond the visible label. */
	searchText?: string;
};
