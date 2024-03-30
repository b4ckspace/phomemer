import {AfterViewInit, Component, ElementRef, ViewChild} from '@angular/core';
import {fabric} from 'fabric';
import {FormBuilder, FormGroup, ReactiveFormsModule} from '@angular/forms';
import {CheckboxModule} from 'primeng/checkbox';
import {NgIf} from '@angular/common';
import {SliderModule} from 'primeng/slider';
import {ButtonModule} from 'primeng/button';
import {HttpClient} from '@angular/common/http';
import {debounceTime, firstValueFrom} from 'rxjs';

@Component({
    selector: 'app-canvas-page',
    standalone: true,
    imports: [
        ReactiveFormsModule,
        CheckboxModule,
        NgIf,
        SliderModule,
        ButtonModule
    ],
    templateUrl: './canvas-page.component.html',
    styleUrl: './canvas-page.component.scss'
})
export class CanvasPageComponent implements AfterViewInit {
    @ViewChild('canvasElement') canvas?: ElementRef<HTMLCanvasElement>;
    public busy = false;
    public fabric?: fabric.Canvas;
    public ctx?: CanvasRenderingContext2D;
    public form: FormGroup;
    public width = 323;
    public height = 240;

    constructor(
        private formBuilder: FormBuilder,
        private httpClient: HttpClient
    ) {
        this.form = this.formBuilder.group({
            drawingMode: [false],
            brushSize: [2],
        });
    }

    public ngAfterViewInit() {
        console.log(this.canvas);
        if (this.canvas) {
            this.fabric = new fabric.Canvas('canvas', {
                backgroundColor: '#fff',
                fill: '#000',
                width: this.width,
                height: this.height,
                interactive: true,
                renderOnAddRemove: true,
            });
        }

        this.form.valueChanges.pipe(debounceTime(50)).subscribe(values => {
            console.log(values);

            if (this.fabric) {
                this.fabric.isDrawingMode = values.drawingMode;
                this.fabric.freeDrawingBrush.width = values.brushSize;
            }
        });
    }

    public async print() {
        this.busy = true;
        try {
            const fd = new FormData();
            fd.append('image', await this.getBlob());
            const response = await firstValueFrom(this.httpClient.post('http://94.45.243.136:5000/print', fd));
            console.log(response);
        } catch (e) {
            console.error(e);
        }
        this.busy = false;
    }

    public clear() {
        this.fabric?.clear();
    }

    private getBlob(): Promise<Blob> {
        return new Promise((resolve, reject) => {
            if (this.canvas) {
                this.canvas.nativeElement.toBlob(blob => {
                    if (blob) {
                        resolve(blob)
                    } else {
                        reject();
                    }
                })
            } else {
                reject();
            }
        });
    }

}
