export interface DatasetEntry {
  label: string;
  data: number[] | number[][];
}

export interface StaticDatasetEntry extends DatasetEntry {
  data: number[];
}

export interface DynamicDatasetEntry extends DatasetEntry {
  data: number[][];
}

export interface DatasetStructure {
  static: StaticDatasetEntry[];
  dynamic: DynamicDatasetEntry[];
}
