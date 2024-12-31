import { Paper } from './paper.model';

export interface Printer {
    device: string;
    name: string;
    paper: Paper;
}
