ROOT=$(shell pwd)

test: test-unit test-integration

test-unit:
	@echo "\nRunning unit tests..."
	@NODE_ENV=test CONFIG_FILE=${ROOT}/config/config.test.js mocha test/unit --recursive

test-integration:
	@echo "\nRunning integration tests..."
	@NODE_ENV=test CONFIG_FILE=${ROOT}/config/config.test.js mocha test/api/init test/api/auth --recursive

coverage:
	@echo "\n\nRunning coverage report..."
	rm -rf coverage
	@NODE_ENV=test CONFIG_FILE=${ROOT}/config/config.test.js ./node_modules/istanbul/lib/cli.js cover --report none --dir coverage/core ./node_modules/.bin/_mocha \
		test/unit -- --recursive
	./node_modules/istanbul/lib/cli.js cover --report none --dir coverage/api ./node_modules/.bin/_mocha \
	test/api/init test/api/auth -- --recursive
	./node_modules/istanbul/lib/cli.js report

.PHONY: coverage