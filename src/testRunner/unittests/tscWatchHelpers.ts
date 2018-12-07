namespace ts.tscWatch {
    export import WatchedSystem = TestFSWithWatch.TestServerHost;
    export type File = TestFSWithWatch.File;
    export type SymLink = TestFSWithWatch.SymLink;
    export import libFile = TestFSWithWatch.libFile;
    export import createWatchedSystem = TestFSWithWatch.createWatchedSystem;
    export import checkArray = TestFSWithWatch.checkArray;
    export import checkWatchedFiles = TestFSWithWatch.checkWatchedFiles;
    export import checkWatchedFilesDetailed = TestFSWithWatch.checkWatchedFilesDetailed;
    export import checkWatchedDirectories = TestFSWithWatch.checkWatchedDirectories;
    export import checkWatchedDirectoriesDetailed = TestFSWithWatch.checkWatchedDirectoriesDetailed;
    export import checkOutputContains = TestFSWithWatch.checkOutputContains;
    export import checkOutputDoesNotContain = TestFSWithWatch.checkOutputDoesNotContain;

    export function checkProgramActualFiles(program: Program, expectedFiles: ReadonlyArray<string>) {
        checkArray(`Program actual files`, program.getSourceFiles().map(file => file.fileName), expectedFiles);
    }

    export function checkProgramRootFiles(program: Program, expectedFiles: ReadonlyArray<string>) {
        checkArray(`Program rootFileNames`, program.getRootFileNames(), expectedFiles);
    }

    export function createWatchOfConfigFileReturningBuilder(configFileName: string, host: WatchedSystem, maxNumberOfFilesToIterateForInvalidation?: number) {
        const compilerHost = createWatchCompilerHostOfConfigFile(configFileName, {}, host);
        compilerHost.maxNumberOfFilesToIterateForInvalidation = maxNumberOfFilesToIterateForInvalidation;
        const watch = createWatchProgram(compilerHost);
        return () => watch.getCurrentProgram();
    }

    export function createWatchOfConfigFile(configFileName: string, host: WatchedSystem, maxNumberOfFilesToIterateForInvalidation?: number) {
        const compilerHost = createWatchCompilerHostOfConfigFile(configFileName, {}, host);
        compilerHost.maxNumberOfFilesToIterateForInvalidation = maxNumberOfFilesToIterateForInvalidation;
        const watch = createWatchProgram(compilerHost);
        return () => watch.getCurrentProgram().getProgram();
    }

    export function createWatchOfFilesAndCompilerOptions(rootFiles: string[], host: WatchedSystem, options: CompilerOptions = {}, maxNumberOfFilesToIterateForInvalidation?: number) {
        const compilerHost = createWatchCompilerHostOfFilesAndCompilerOptions(rootFiles, options, host);
        compilerHost.maxNumberOfFilesToIterateForInvalidation = maxNumberOfFilesToIterateForInvalidation;
        const watch = createWatchProgram(compilerHost);
        return () => watch.getCurrentProgram().getProgram();
    }

    //function getEmittedLineForMultiFileOutput(file: File, host: WatchedSystem) {
    //    return `TSFILE: ${file.path.replace(".ts", ".js")}${host.newLine}`;
    //}

    //function getEmittedLineForSingleFileOutput(filename: string, host: WatchedSystem) {
    //    return `TSFILE: ${filename}${host.newLine}`;
    //}

    //interface FileOrFolderEmit extends File {
    //    output?: string;
    //}

    //function getFileOrFolderEmit(file: File, getOutput?: (file: File) => string): FileOrFolderEmit {
    //    const result = file as FileOrFolderEmit;
    //    if (getOutput) {
    //        result.output = getOutput(file);
    //    }
    //    return result;
    //}

    //function getEmittedLines(files: FileOrFolderEmit[]) {
    //    const seen = createMap<true>();
    //    const result: string[] = [];
    //    for (const { output } of files) {
    //        if (output && !seen.has(output)) {
    //            seen.set(output, true);
    //            result.push(output);
    //        }
    //    }
    //    return result;
    //}

    //function checkAffectedLines(host: WatchedSystem, affectedFiles: FileOrFolderEmit[], allEmittedFiles: string[]) {
    //    const expectedAffectedFiles = getEmittedLines(affectedFiles);
    //    const expectedNonAffectedFiles = mapDefined(allEmittedFiles, line => contains(expectedAffectedFiles, line) ? undefined : line);
    //    checkOutputContains(host, expectedAffectedFiles);
    //    checkOutputDoesNotContain(host, expectedNonAffectedFiles);
    //}

    const elapsedRegex = /^Elapsed:: [0-9]+ms/;
    function checkOutputErrors(
        host: WatchedSystem,
        logsBeforeWatchDiagnostic: string[] | undefined,
        preErrorsWatchDiagnostic: Diagnostic,
        logsBeforeErrors: string[] | undefined,
        errors: ReadonlyArray<Diagnostic> | ReadonlyArray<string>,
        disableConsoleClears?: boolean | undefined,
        ...postErrorsWatchDiagnostics: Diagnostic[]
    ) {
        let screenClears = 0;
        const outputs = host.getOutput();
        const expectedOutputCount = 1 + errors.length + postErrorsWatchDiagnostics.length +
            (logsBeforeWatchDiagnostic ? logsBeforeWatchDiagnostic.length : 0) + (logsBeforeErrors ? logsBeforeErrors.length : 0);
        assert.equal(outputs.length, expectedOutputCount, JSON.stringify(outputs));
        let index = 0;
        forEach(logsBeforeWatchDiagnostic, log => assertLog("logsBeforeWatchDiagnostic", log));
        assertWatchDiagnostic(preErrorsWatchDiagnostic);
        forEach(logsBeforeErrors, log => assertLog("logBeforeError", log));
        // Verify errors
        forEach(errors, assertDiagnostic);
        forEach(postErrorsWatchDiagnostics, assertWatchDiagnostic);
        assert.equal(host.screenClears.length, screenClears, "Expected number of screen clears");
        host.clearOutput();

        function isDiagnostic(diagnostic: Diagnostic | string): diagnostic is Diagnostic {
            return !!(diagnostic as Diagnostic).messageText;
        }

        function assertDiagnostic(diagnostic: Diagnostic | string) {
            const expected = isDiagnostic(diagnostic) ? formatDiagnostic(diagnostic, host) : diagnostic;
            assert.equal(outputs[index], expected, getOutputAtFailedMessage("Diagnostic", expected));
            index++;
        }

        function assertLog(caption: string, expected: string) {
            const actual = outputs[index];
            assert.equal(actual.replace(elapsedRegex, ""), expected.replace(elapsedRegex, ""), getOutputAtFailedMessage(caption, expected));
            index++;
        }

        function assertWatchDiagnostic(diagnostic: Diagnostic) {
            const expected = getWatchDiagnosticWithoutDate(diagnostic);
            if (!disableConsoleClears && contains(screenStartingMessageCodes, diagnostic.code)) {
                assert.equal(host.screenClears[screenClears], index, `Expected screen clear at this diagnostic: ${expected}`);
                screenClears++;
            }
            assert.isTrue(endsWith(outputs[index], expected), getOutputAtFailedMessage("Watch diagnostic", expected));
            index++;
        }

        function getOutputAtFailedMessage(caption: string, expectedOutput: string) {
            return `Expected ${caption}: ${JSON.stringify(expectedOutput)} at ${index} in ${JSON.stringify(outputs)}`;
        }

        function getWatchDiagnosticWithoutDate(diagnostic: Diagnostic) {
            const newLines = contains(screenStartingMessageCodes, diagnostic.code)
                ? `${host.newLine}${host.newLine}`
                : host.newLine;
            return ` - ${flattenDiagnosticMessageText(diagnostic.messageText, host.newLine)}${newLines}`;
        }
    }

    function createErrorsFoundCompilerDiagnostic(errors: ReadonlyArray<Diagnostic> | ReadonlyArray<string>) {
        return errors.length === 1
            ? createCompilerDiagnostic(Diagnostics.Found_1_error_Watching_for_file_changes)
            : createCompilerDiagnostic(Diagnostics.Found_0_errors_Watching_for_file_changes, errors.length);
    }

    export function checkOutputErrorsInitial(host: WatchedSystem, errors: ReadonlyArray<Diagnostic> | ReadonlyArray<string>, disableConsoleClears?: boolean, logsBeforeErrors?: string[]) {
        checkOutputErrors(
            host,
            /*logsBeforeWatchDiagnostic*/ undefined,
            createCompilerDiagnostic(Diagnostics.Starting_compilation_in_watch_mode),
            logsBeforeErrors,
            errors,
            disableConsoleClears,
            createErrorsFoundCompilerDiagnostic(errors));
    }

    export function checkOutputErrorsIncremental(host: WatchedSystem, errors: ReadonlyArray<Diagnostic> | ReadonlyArray<string>, disableConsoleClears?: boolean, logsBeforeWatchDiagnostic?: string[], logsBeforeErrors?: string[]) {
        checkOutputErrors(
            host,
            logsBeforeWatchDiagnostic,
            createCompilerDiagnostic(Diagnostics.File_change_detected_Starting_incremental_compilation),
            logsBeforeErrors,
            errors,
            disableConsoleClears,
            createErrorsFoundCompilerDiagnostic(errors));
    }

    export function checkOutputErrorsIncrementalWithExit(host: WatchedSystem, errors: ReadonlyArray<Diagnostic> | ReadonlyArray<string>, expectedExitCode: ExitStatus, disableConsoleClears?: boolean, logsBeforeWatchDiagnostic?: string[], logsBeforeErrors?: string[]) {
        checkOutputErrors(
            host,
            logsBeforeWatchDiagnostic,
            createCompilerDiagnostic(Diagnostics.File_change_detected_Starting_incremental_compilation),
            logsBeforeErrors,
            errors,
            disableConsoleClears);
        assert.equal(host.exitCode, expectedExitCode);
    }

    function getDiagnosticOfFileFrom(file: SourceFile | undefined, text: string, start: number | undefined, length: number | undefined, message: DiagnosticMessage): Diagnostic {
        return {
            file,
            start,
            length,

            messageText: text,
            category: message.category,
            code: message.code,
        };
    }

    //function getDiagnosticWithoutFile(message: DiagnosticMessage, ..._args: (string | number)[]): Diagnostic {
    //    let text = getLocaleSpecificMessage(message);

    //    if (arguments.length > 1) {
    //        text = formatStringFromArgs(text, arguments, 1);
    //    }

    //    return getDiagnosticOfFileFrom(/*file*/ undefined, text, /*start*/ undefined, /*length*/ undefined, message);
    //}

    //function getDiagnosticOfFile(file: SourceFile, start: number, length: number, message: DiagnosticMessage, ..._args: (string | number)[]): Diagnostic {
    //    let text = getLocaleSpecificMessage(message);

    //    if (arguments.length > 4) {
    //        text = formatStringFromArgs(text, arguments, 4);
    //    }

    //    return getDiagnosticOfFileFrom(file, text, start, length, message);
    //}

    //function getUnknownCompilerOption(program: Program, configFile: File, option: string) {
    //    const quotedOption = `"${option}"`;
    //    return getDiagnosticOfFile(program.getCompilerOptions().configFile!, configFile.content.indexOf(quotedOption), quotedOption.length, Diagnostics.Unknown_compiler_option_0, option);
    //}

    export function getDiagnosticOfFileFromProgram(program: Program, filePath: string, start: number, length: number, message: DiagnosticMessage, ..._args: (string | number)[]): Diagnostic {
        let text = getLocaleSpecificMessage(message);

        if (arguments.length > 5) {
            text = formatStringFromArgs(text, arguments, 5);
        }

        return getDiagnosticOfFileFrom(program.getSourceFileByPath(toPath(filePath, program.getCurrentDirectory(), s => s.toLowerCase()))!,
            text, start, length, message);
    }

    export function getDiagnosticModuleNotFoundOfFile(program: Program, file: File, moduleName: string) {
        const quotedModuleName = `"${moduleName}"`;
        return getDiagnosticOfFileFromProgram(program, file.path, file.content.indexOf(quotedModuleName), quotedModuleName.length, Diagnostics.Cannot_find_module_0, moduleName);
    }
}
