import { EventServiceProvider, EVENT_SERVICE } from './../../providers/service.providers';
import { USER_SERVICE } from './../../providers/service.providers';
import { EventService } from '../../services/event.service';
import { Component, Inject, OnInit } from '@angular/core';
import { Event } from '../../models/Event';
import { LocalizableError } from 'src/app/models/LocalizableError';
import { debounceTime } from 'rxjs/operators';
import { Subject, Observable } from 'rxjs';
import { LabelsService } from 'src/app/services/labels.service';
import { TimeDisplayConfig } from '../../../assets/config/config';
import { DatePipe } from '@angular/common';
import { DateFormatter } from 'src/app/helpers/DateFormatter';
import { UserService } from 'src/app/services/user.service';
import { Router } from '@angular/router';
import { ImageHelper } from 'src/app/helpers/ImageHelper';
import { environment } from "./../../../environments/environment";

@Component({
    // tslint:disable-next-line:component-selector
    selector: 'home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
    public allEvents: Event[] = [];
    public filteredEvents: Event[] = [];
    public isLoading: boolean;
    public isRedirected: boolean;
    public error?: LocalizableError;
    private subject: Subject<string> = new Subject();
    private timeDisplayConfig: any;
    private defaultImageUrlSelfHosted = 'default-event-image.jpg';
    private defaultImageUrlCrmHosted = 'homehero.jpg';


    constructor(
        @Inject(EVENT_SERVICE) private eventService: EventService,
        @Inject(USER_SERVICE) private userService: UserService,
        private labelsService: LabelsService,
        private datePipe: DatePipe,
        private imageHelper: ImageHelper,
        private router: Router) {
    }

    ngOnInit(): void {
        this.timeDisplayConfig = TimeDisplayConfig;
        this.isLoading = true;
        this.isRedirected = false;
        this.loadLoginPopup();
        this.loadPublishedEvents();
        this.subject.pipe(
            debounceTime(300)
        ).subscribe(searchTextValue => {
            this.handleSearch(searchTextValue);
        });
    }

    private loadLoginPopup(){
        this.userService.getLoggedInUser().subscribe((data)=>{
            if(data.isAnonymous && this.isRedirected === false){
                this.isRedirected = true;
                this.router.navigate(['/externalLogin'])
            }else if(!data.isAnonymous){
                this.isRedirected = false;
            }
        });
    }

    private async filterEvents(events: Event[]){
        var currentUser;
        this.userService.getLoggedInUser().subscribe(
            user => {
                currentUser = user;
                console.log(currentUser)
            },
            error => console.error(error)
        );
        events.forEach(event=>{
            if(currentUser)
            this.eventService.canUserViewEvent(currentUser.email, event.eventId).subscribe((data)=>{
                console.log(data)
                if(data === "Yes"){                 
                    this.allEvents.push(event)
                    this.filteredEvents.push(event)
                }
            })
        })
        this.isLoading = false;
   }

    private async loadPublishedEvents() {
        this.eventService.getPublishedEvents().subscribe(
            events => {
                this.filterEvents(events)
            },
            (error: LocalizableError) => this.handleErrorResponse(error)
        );
    }

    private handleErrorResponse(error: LocalizableError) {
        this.error = error;
        this.isLoading = false;
    }

    public translateLabel(translationKey: string, defaultValue: string): Observable<string> {
        return this.labelsService.translateLabel(translationKey, defaultValue);
    }

    private getAreaLabel(event: Event): string {
        let date = this.getDateString(event);
        let building = event.building ? `at ${event.building.name}` : "";
        return `${event.eventName} on ${date} ${building}`;
    }

    public getDateString(event: Event): string {
        let dateSettings = DateFormatter.getDateSettings();

        if(dateSettings.convertToLocalDate){
            return DateFormatter.formatRangedDate(this.datePipe, event.startDateUTC, event.endDateUTC);
        }
        else{
            return DateFormatter.formatRangedDate(this.datePipe, event.startDate, event.endDate, event.timeZone);
        }
    }

    public getBannerImage(event: Event) {
        if (event == null) {
            // This early exit avoids showing placeholder image while event isn't loaded.
            return '';
        }

        if (event.image != null) {
            return event.image;
        } else {
            if (environment.useRestStack === true) {
                return this.imageHelper.getImageUrl(this.defaultImageUrlSelfHosted);
            } else {
                return this.imageHelper.getImageUrl(this.defaultImageUrlCrmHosted);
            }
        }
    }
    handleSearch(searchText: string) {
        if (searchText) {
            searchText = searchText.toLocaleLowerCase();
        }
        this.filteredEvents = this.allEvents.filter((it: Event) => {
            return it.eventName.toString().toLocaleLowerCase().includes(searchText);
        });
    }

    search(searchText: string) {
        this.subject.next(searchText);
    }

    orderEvents(order: string) {
        if (order === "date-asc") {
            this.filteredEvents.sort((a, b) => { return <any>new Date(a.startDate.toString()) - <any>new Date(b.startDate.toString()) });
        } else if (order === "date-desc") {
            this.filteredEvents.sort((a, b) => { return <any>new Date(b.startDate.toString()) - <any>new Date(a.startDate.toString()) });
        } else if (order === "name-asc") {
            this.filteredEvents.sort((a, b) => a.eventName.localeCompare(b.eventName));
        } else if (order === "name-desc") {
            this.filteredEvents.sort((a, b) => b.eventName.localeCompare(a.eventName));
        }
    }
}
