import chrono from 'chrono-node';

import { Status, Task } from './Task';

export class Query {
    private _limit: number | undefined = undefined;
    private _showTaskCount: boolean = true;
    private _showBacklinks: boolean = true;
    private _filters: ((task: Task) => boolean)[] = [];
    private _error: string | undefined = undefined;

    private readonly noDueString = 'no due date';
    private readonly dueRegexp = /due (before|after|on)? ?(.*)/;
    private readonly doneString = 'done';
    private readonly notDoneString = 'not done';
    private readonly doneRegexp = /done (before|after|on)? ?(.*)/;
    private readonly pathRegexp = /path (includes|does not include) (.*)/;
    private readonly descriptionRegexp =
        /description (includes|does not include) (.*)/;
    private readonly headingRegexp = /heading (includes|does not include) (.*)/;
    private readonly layoutRegexp = /(layoutOptions): (.*)/
    private readonly limitRegexp = /limit (to )?(\d+)( tasks?)?/;
    private readonly excludeSubItemsString = 'exclude sub-items';

    constructor({ source }: { source: string }) {
        source
            .split('\n')
            .map((line: string) => line.trim())
            .forEach((line: string) => {
                switch (true) {
                    case line === '':
                        break;
                    case line === this.doneString:
                        this._filters.push(
                            (task) => task.status === Status.Done,
                        );
                        break;
                    case line === this.notDoneString:
                        this._filters.push(
                            (task) => task.status !== Status.Done,
                        );
                        break;
                    case line === this.excludeSubItemsString:
                        this._filters.push((task) => task.indentation === '');
                        break;
                    case line === this.noDueString:
                        this._filters.push((task) => task.dueDate === null);
                        break;
                    case this.dueRegexp.test(line):
                        this.parseDueFilter({ line });
                        break;
                    case this.doneRegexp.test(line):
                        this.parseDoneFilter({ line });
                        break;
                    case this.pathRegexp.test(line):
                        this.parsePathFilter({ line });
                        break;
                    case this.descriptionRegexp.test(line):
                        this.parseDescriptionFilter({ line });
                        break;
                    case this.headingRegexp.test(line):
                        this.parseHeadingFilter({ line });
                        break;
                    case this.limitRegexp.test(line):
                        this.parseLimit({ line });
                        break;
                    case this.layoutRegexp.test(line):
                        this.parseLayout({ line });
                        break;
                    default:
                        this._error = 'do not understand query';
                }
            });
    }

    public get limit(): number | undefined {
        return this._limit;
    }

    public get showTaskCount(): boolean {
        return this._showTaskCount;
    }

    public get showBacklinks(): boolean {
        return this._showBacklinks;
    }

    public get filters(): ((task: Task) => boolean)[] {
        return this._filters;
    }

    public get error(): string | undefined {
        return this._error;
    }

    private parseLayout({ line }: { line: string }): void {
        const layoutOptionMatch = line.match(this.layoutRegexp);
        if (layoutOptionMatch !== null) {
            var splittedOptions = layoutOptionMatch[2].split(",");

            splittedOptions.forEach(s => {
                var option = s.trim().toLowerCase()

                if (option === 'hidetaskcount') {
                    this._showTaskCount = false;
                } else if (option === 'hidebacklinks') {
                    this._showBacklinks = false;
                } else {
                    this._error = 'do not understand layout option';
                }
            });
        }
    }

    private parseDueFilter({ line }: { line: string }): void {
        const dueMatch = line.match(this.dueRegexp);
        if (dueMatch !== null) {
            const filterDate = this.parseDate(dueMatch[2]);
            if (!filterDate.isValid()) {
                this._error = 'do not understand due date';
            }

            let filter;
            if (dueMatch[1] === 'before') {
                filter = (task: Task) =>
                    task.dueDate ? task.dueDate.isBefore(filterDate) : false;
            } else if (dueMatch[1] === 'after') {
                filter = (task: Task) =>
                    task.dueDate ? task.dueDate.isAfter(filterDate) : false;
            } else {
                filter = (task: Task) =>
                    task.dueDate ? task.dueDate.isSame(filterDate) : false;
            }

            this._filters.push(filter);
        } else {
            this._error = 'do not understand query filter (due date)';
        }
    }

    private parseDoneFilter({ line }: { line: string }): void {
        const doneMatch = line.match(this.doneRegexp);
        if (doneMatch !== null) {
            const filterDate = this.parseDate(doneMatch[2]);
            if (!filterDate.isValid()) {
                this._error = 'do not understand done date';
            }

            let filter;
            if (doneMatch[1] === 'before') {
                filter = (task: Task) =>
                    task.doneDate ? task.doneDate.isBefore(filterDate) : false;
            } else if (doneMatch[1] === 'after') {
                filter = (task: Task) =>
                    task.doneDate ? task.doneDate.isAfter(filterDate) : false;
            } else {
                filter = (task: Task) =>
                    task.doneDate ? task.doneDate.isSame(filterDate) : false;
            }

            this._filters.push(filter);
        }
    }

    private parsePathFilter({ line }: { line: string }): void {
        const pathMatch = line.match(this.pathRegexp);
        if (pathMatch !== null) {
            const filterMethod = pathMatch[1];
            if (filterMethod === 'includes') {
                this._filters.push((task: Task) =>
                    task.path.includes(pathMatch[2]),
                );
            } else if (pathMatch[1] === 'does not include') {
                this._filters.push(
                    (task: Task) => !task.path.includes(pathMatch[2]),
                );
            } else {
                this._error = 'do not understand query filter (path)';
            }
        } else {
            this._error = 'do not understand query filter (path)';
        }
    }

    private parseDescriptionFilter({ line }: { line: string }): void {
        const descriptionMatch = line.match(this.descriptionRegexp);
        if (descriptionMatch !== null) {
            const filterMethod = descriptionMatch[1];
            if (filterMethod === 'includes') {
                this._filters.push((task: Task) =>
                    this.stringIncludesCaseInsensitive(
                        task.description,
                        descriptionMatch[2],
                    ),
                );
            } else if (descriptionMatch[1] === 'does not include') {
                this._filters.push(
                    (task: Task) =>
                        !this.stringIncludesCaseInsensitive(
                            task.description,
                            descriptionMatch[2],
                        ),
                );
            } else {
                this._error = 'do not understand query filter (description)';
            }
        } else {
            this._error = 'do not understand query filter (description)';
        }
    }

    private parseHeadingFilter({ line }: { line: string }): void {
        const headingMatch = line.match(this.headingRegexp);
        if (headingMatch !== null) {
            const filterMethod = headingMatch[1].toLowerCase();
            if (filterMethod === 'includes') {
                this._filters.push(
                    (task: Task) =>
                        task.precedingHeader !== null &&
                        this.stringIncludesCaseInsensitive(
                            task.precedingHeader,
                            headingMatch[2],
                        ),
                );
            } else if (headingMatch[1] === 'does not include') {
                this._filters.push(
                    (task: Task) =>
                        task.precedingHeader !== null &&
                        !this.stringIncludesCaseInsensitive(
                            task.precedingHeader,
                            headingMatch[2],
                        ),
                );
            } else {
                this._error = 'do not understand query filter (heading)';
            }
        } else {
            this._error = 'do not understand query filter (heading)';
        }
    }

    private parseLimit({ line }: { line: string }): void {
        const limitMatch = line.match(this.limitRegexp);
        if (limitMatch !== null) {
            // limitMatch[2] is per regex always digits and therefore parsable.
            const limit = Number.parseInt(limitMatch[2], 10);
            this._limit = limit;
        } else {
            this._error = 'do not understand query limit';
        }
    }

    private parseDate(input: string): moment.Moment {
        // Using start of date to correctly match on comparison with other dates (like equality).
        return window.moment(chrono.parseDate(input)).startOf('day');
    }

    private stringIncludesCaseInsensitive(
        haystack: string,
        needle: string,
    ): boolean {
        return haystack
            .toLocaleLowerCase()
            .includes(needle.toLocaleLowerCase());
    }
}
