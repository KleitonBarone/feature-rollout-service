/** Symbol key applied to readonly types */
declare const ReadonlyKind: unique symbol;
/** Symbol key applied to optional types */
declare const OptionalKind: unique symbol;
/** Symbol key applied to types */
declare const Hint: unique symbol;
/** Symbol key applied to types */
declare const Kind: unique symbol;

type TReadonly<T extends TSchema> = T & {
    [ReadonlyKind]: 'Readonly';
};

type TLiteralValue = boolean | number | string;
interface TLiteral<T extends TLiteralValue = TLiteralValue> extends TSchema {
    [Kind]: 'Literal';
    static: T;
    const: T;
}

type UnionStatic<T extends TSchema[], P extends unknown[]> = {
    [K in keyof T]: T[K] extends TSchema ? Static<T[K], P> : never;
}[number];
interface TUnion<T extends TSchema[] = TSchema[]> extends TSchema {
    [Kind]: 'Union';
    static: UnionStatic<T, this['params']>;
    anyOf: T;
}

type StringFormatOption = 'date-time' | 'time' | 'date' | 'email' | 'idn-email' | 'hostname' | 'idn-hostname' | 'ipv4' | 'ipv6' | 'uri' | 'uri-reference' | 'iri' | 'uuid' | 'iri-reference' | 'uri-template' | 'json-pointer' | 'relative-json-pointer' | 'regex' | ({} & string);
type StringContentEncodingOption = '7bit' | '8bit' | 'binary' | 'quoted-printable' | 'base64' | ({} & string);
interface StringOptions extends SchemaOptions {
    /** The maximum string length */
    maxLength?: number;
    /** The minimum string length */
    minLength?: number;
    /** A regular expression pattern this string should match */
    pattern?: string;
    /** A format this string should match */
    format?: StringFormatOption;
    /** The content encoding for this string */
    contentEncoding?: StringContentEncodingOption;
    /** The content media type for this string */
    contentMediaType?: string;
}
interface TString extends TSchema, StringOptions {
    [Kind]: 'String';
    static: string;
    type: 'string';
}

interface TBoolean extends TSchema {
    [Kind]: 'Boolean';
    static: boolean;
    type: 'boolean';
}

interface NumberOptions extends SchemaOptions {
    exclusiveMaximum?: number;
    exclusiveMinimum?: number;
    maximum?: number;
    minimum?: number;
    multipleOf?: number;
}
interface TNumber extends TSchema, NumberOptions {
    [Kind]: 'Number';
    static: number;
    type: 'number';
}

interface IntegerOptions extends SchemaOptions {
    exclusiveMaximum?: number;
    exclusiveMinimum?: number;
    maximum?: number;
    minimum?: number;
    multipleOf?: number;
}
interface TInteger extends TSchema, IntegerOptions {
    [Kind]: 'Integer';
    static: number;
    type: 'integer';
}

type TOptional<T extends TSchema> = T & {
    [OptionalKind]: 'Optional';
};

type RecordStatic<Key extends TSchema, Type extends TSchema, P extends unknown[]> = (Evaluate<{
    [_ in Assert<Static<Key>, PropertyKey>]: Static<Type, P>;
}>);
interface TRecord<Key extends TSchema = TSchema, Type extends TSchema = TSchema> extends TSchema {
    [Kind]: 'Record';
    static: RecordStatic<Key, Type, this['params']>;
    type: 'object';
    patternProperties: {
        [pattern: string]: Type;
    };
    additionalProperties: TAdditionalProperties;
}

/** Creates a static type from a TypeBox type */
type Static<Type extends TSchema, Params extends unknown[] = [], Result = (Type & {
    params: Params;
})['static']> = Result;

type ReadonlyOptionalPropertyKeys<T extends TProperties> = {
    [K in keyof T]: T[K] extends TReadonly<TSchema> ? (T[K] extends TOptional<T[K]> ? K : never) : never;
}[keyof T];
type ReadonlyPropertyKeys<T extends TProperties> = {
    [K in keyof T]: T[K] extends TReadonly<TSchema> ? (T[K] extends TOptional<T[K]> ? never : K) : never;
}[keyof T];
type OptionalPropertyKeys<T extends TProperties> = {
    [K in keyof T]: T[K] extends TOptional<TSchema> ? (T[K] extends TReadonly<T[K]> ? never : K) : never;
}[keyof T];
type RequiredPropertyKeys<T extends TProperties> = keyof Omit<T, ReadonlyOptionalPropertyKeys<T> | ReadonlyPropertyKeys<T> | OptionalPropertyKeys<T>>;
type ObjectStaticProperties<T extends TProperties, R extends Record<keyof any, unknown>> = Evaluate<(Readonly<Partial<Pick<R, ReadonlyOptionalPropertyKeys<T>>>> & Readonly<Pick<R, ReadonlyPropertyKeys<T>>> & Partial<Pick<R, OptionalPropertyKeys<T>>> & Required<Pick<R, RequiredPropertyKeys<T>>>)>;
type ObjectStatic<T extends TProperties, P extends unknown[]> = ObjectStaticProperties<T, {
    [K in keyof T]: Static<T[K], P>;
}>;
type TPropertyKey = string | number;
type TProperties = Record<TPropertyKey, TSchema>;
type TIsLiteralString<Type extends string> = ([
    Type
] extends [string] ? [string] extends [Type] ? false : true : false);
type IsRequiredArrayLiteralConstant<RequiredTuple extends string[]> = (RequiredTuple extends [infer Left extends string, ...infer _ extends string[]] ? TIsLiteralString<Left> : false);
type TRequiredArray<Properties extends TProperties, RequiredProperties extends TProperties = {
    [Key in keyof Properties as Properties[Key] extends TOptional<Properties[Key]> ? never : Key]: Properties[Key];
}, RequiredUnion extends string = Extract<keyof RequiredProperties, string>, RequiredTuple extends string[] = UnionToTuple<RequiredUnion>, Result extends string[] | undefined = (IsRequiredArrayLiteralConstant<RequiredTuple> extends true ? RequiredTuple : string[] | undefined)> = Result;
type TAdditionalProperties = undefined | TSchema | boolean;
interface ObjectOptions extends SchemaOptions {
    /** Additional property constraints for this object */
    additionalProperties?: TAdditionalProperties;
    /** The minimum number of properties allowed on this object */
    minProperties?: number;
    /** The maximum number of properties allowed on this object */
    maxProperties?: number;
}
interface TObject<T extends TProperties = TProperties> extends TSchema, ObjectOptions {
    [Kind]: 'Object';
    static: ObjectStatic<T, this['params']>;
    additionalProperties?: TAdditionalProperties;
    type: 'object';
    properties: T;
    required: TRequiredArray<T>;
}

type UnionToIntersect<U> = (U extends unknown ? (arg: U) => 0 : never) extends (arg: infer I) => 0 ? I : never;
type UnionLast<U> = UnionToIntersect<U extends unknown ? (x: U) => 0 : never> extends (x: infer L) => 0 ? L : never;
type UnionToTuple<U, Acc extends unknown[] = [], R = UnionLast<U>> = [U] extends [never] ? Acc : UnionToTuple<Exclude<U, R>, [Extract<U, R>, ...Acc]>;
type Assert<T, E> = T extends E ? T : never;
type Evaluate<T> = T extends infer O ? {
    [K in keyof O]: O[K];
} : never;
type Ensure<T> = T extends infer U ? U : never;

interface ArrayOptions extends SchemaOptions {
    /** The minimum number of items in this array */
    minItems?: number;
    /** The maximum number of items in this array */
    maxItems?: number;
    /** Should this schema contain unique items */
    uniqueItems?: boolean;
    /** A schema for which some elements should match */
    contains?: TSchema;
    /** A minimum number of contains schema matches */
    minContains?: number;
    /** A maximum number of contains schema matches */
    maxContains?: number;
}
type ArrayStatic<T extends TSchema, P extends unknown[]> = Ensure<Static<T, P>[]>;
interface TArray<T extends TSchema = TSchema> extends TSchema, ArrayOptions {
    [Kind]: 'Array';
    static: ArrayStatic<T, this['params']>;
    type: 'array';
    items: T;
}

interface SchemaOptions {
    $schema?: string;
    /** Id for this schema */
    $id?: string;
    /** Title of this schema */
    title?: string;
    /** Description of this schema */
    description?: string;
    /** Default value for this schema */
    default?: any;
    /** Example values matching this schema */
    examples?: any;
    /** Optional annotation for readOnly */
    readOnly?: boolean;
    /** Optional annotation for writeOnly */
    writeOnly?: boolean;
    [prop: string]: any;
}
interface TKind {
    [Kind]: string;
}
interface TSchema extends TKind, SchemaOptions {
    [ReadonlyKind]?: string;
    [OptionalKind]?: string;
    [Hint]?: string;
    params: unknown[];
    static: unknown;
}

declare const EvaluationContextSchema: TObject<{
    schemaVersion: TLiteral<"evaluation-context-v1">;
    targetingKey: TOptional<TString>;
    attributes: TOptional<TRecord<TString, TUnion<[TString, TNumber, TBoolean]>>>;
}>;
type EvaluationContext = Static<typeof EvaluationContextSchema>;
declare const ConfigurationV2Schema: TObject<{
    configurationVersion: TInteger;
    environment: TString;
    generatedAt: TString;
    flags: TArray<TUnion<[TObject<{
        key: TString;
        type: TLiteral<"boolean">;
        defaultValue: TBoolean;
        rules: TArray<TObject<{
            id: TString;
            conditions: TArray<TObject<{
                attribute: TString;
                operator: TUnion<[TLiteral<"equals">, TLiteral<"not-equals">]>;
                value: TUnion<[TString, TNumber, TBoolean]>;
            }>>;
            serve: TBoolean;
        }>>;
        rollout: TOptional<TObject<{
            id: TString;
            bucketBy: TString;
            salt: TString;
            allocations: TArray<TObject<{
                serve: TBoolean;
                weight: TInteger;
            }>>;
        }>>;
    }>, TObject<{
        key: TString;
        type: TLiteral<"multivariate">;
        variants: TArray<TObject<{
            key: TString;
            value: TString;
        }>>;
        defaultVariant: TString;
        rules: TArray<TObject<{
            id: TString;
            conditions: TArray<TObject<{
                attribute: TString;
                operator: TUnion<[TLiteral<"equals">, TLiteral<"not-equals">]>;
                value: TUnion<[TString, TNumber, TBoolean]>;
            }>>;
            serve: TString;
        }>>;
        rollout: TOptional<TObject<{
            id: TString;
            bucketBy: TString;
            salt: TString;
            allocations: TArray<TObject<{
                serve: TString;
                weight: TInteger;
            }>>;
        }>>;
    }>]>>;
    schemaVersion: TLiteral<"configuration-v2">;
}>;
type ConfigurationV2 = Static<typeof ConfigurationV2Schema>;

declare const reasonCodes: readonly ["TARGETING_MATCH", "PERCENTAGE_MATCH", "DEFAULT_NO_MATCH", "DEFAULT_MISSING_BUCKET_ATTRIBUTE", "DEFAULT_STALE_CONFIGURATION", "FALLBACK_INVALID_CONFIGURATION", "DEFAULT_INVALID_CONTEXT", "FALLBACK_FLAG_NOT_FOUND", "FALLBACK_FLAG_TYPE_MISMATCH"];
type ReasonCode = (typeof reasonCodes)[number];
type EvaluationDetails<T> = {
    value: T;
    flagKey: string;
    reasonCode: ReasonCode;
    configurationVersion?: number;
    ruleId?: string;
    rolloutId?: string;
    bucket?: number;
    variantKey?: string;
};

type Context = Omit<EvaluationContext, "schemaVersion">;
type ClientStatus = {
    state: "idle" | "loading" | "ready" | "stale" | "closed";
    version?: number;
    lastError?: string;
};
type Bootstrap = {
    configuration: ConfigurationV2;
    validatedAt: number;
};
type Observer<T extends object> = (value: Readonly<T>) => unknown;
type ClientOptions = {
    url: string;
    token: string;
    environment: string;
    refreshIntervalMs?: number;
    requestTimeoutMs?: number;
    initializationTimeoutMs?: number;
    maxAgeMs?: number;
    maxConfigurationBytes?: number;
    bootstrap?: Bootstrap;
    fetch?: typeof globalThis.fetch;
    now?: () => number;
    onStatus?: Observer<ClientStatus>;
    onEvaluation?: Observer<EvaluationDetails<boolean | string>>;
};
/** One client per environment. All flag checks are synchronous and use a local snapshot. */
declare class RolloutClient {
    private readonly options;
    private snapshot;
    private etag;
    private lastValidated;
    private verifiedAt;
    private started;
    private closed;
    private forcedStale;
    private error;
    private timer;
    private inFlight;
    private abort;
    private failures;
    private readonly waiters;
    private readonly clock;
    private readonly transport;
    private readonly endpoint;
    private readonly refreshInterval;
    private readonly requestTimeout;
    private readonly initializationTimeout;
    private readonly maxAge;
    private readonly maxBytes;
    constructor(options: ClientOptions);
    private digest;
    status(): ClientStatus;
    private notify;
    start(): Promise<void>;
    waitForReady(timeoutMs?: number): Promise<void>;
    refresh(): Promise<boolean>;
    private load;
    booleanDetails(key: string, context: Context, fallbackValue: boolean): EvaluationDetails<boolean>;
    boolean(key: string, context: Context, fallbackValue: boolean): boolean;
    multivariateDetails(key: string, context: Context, fallbackValue: string): EvaluationDetails<string>;
    multivariate(key: string, context: Context, fallbackValue: string): string;
    exportSnapshot(): Bootstrap | undefined;
    close(): Promise<void>;
}

export { RolloutClient };
export type { Bootstrap, ClientOptions, ClientStatus, ConfigurationV2, Context, EvaluationDetails };
