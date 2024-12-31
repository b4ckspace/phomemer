import { Routes } from '@angular/router';
import { CanvasPageComponent } from './canvas-page/canvas-page.component';

export const routes: Routes = [
    {
        path: '',
        pathMatch: 'full',
        component: CanvasPageComponent,
    },
];
