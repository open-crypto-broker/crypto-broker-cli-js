export function addLocalBenchmarkParser(sub_parsers) {
    const localBenchmark_parser = sub_parsers.add_parser('local-benchmark', {
        help: 'runs the local benchmark',
    });
    localBenchmark_parser.add_argument('--hashData-data', {
        help: 'String to be hashed',
        required: true,
    });
    localBenchmark_parser.add_argument('--signCertificate-csr', {
        help: 'Path to CSR file',
        required: true,
    });
    localBenchmark_parser.add_argument('--signCertificate-caCert', {
        help: 'Path to CA certificate file',
        required: true,
    });
    localBenchmark_parser.add_argument('--signCertificate-caKey', {
        help: 'Path to CA private key file',
        required: true,
    });
    return localBenchmark_parser;
}
//# sourceMappingURL=local_benchmark.js.map